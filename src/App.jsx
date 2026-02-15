// 貯金箱トラッカー フロント

import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { apiUrl, apiFetch, setToken as saveToken, clearToken } from "./api";

// 貯金の種別
const AMOUNTS = [
  { label: "+500円", amount: 500 },
  // { label: "-500円", amount: -500 },
  // { label: "+1円", amount: 1 },
  // { label: "-1円", amount: -1 },
];

// 期間の種別
const RANGES = [
  { key: "7d", label: "1週間", days: 7 },
  { key: "30d", label: "1ヶ月", days: 30 },
  { key: "90d", label: "3ヶ月", days: 90 },
  { key: "180d", label: "半年", days: 180 },
  { key: "365d", label: "1年", days: 365 },
  { key: "all", label: "全期間", days: null },
];

// サービスワーカーを動かす(PWA用)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

// X軸のラベルを作成
function formatXAxisLabel(dateStr, granularity) {
  if (!dateStr) return "";
  if (granularity === "month") return dateStr.slice(0, 7);
  if (granularity === "week") return dateStr.slice(5).replace("-", "/");
  return dateStr.slice(5).replace("-", "/");
}

// ツールチップのラベル文言作成
function formatTooltipLabel(dateStr, granularity) {
  if (!dateStr) return "";
  if (granularity === "month") return `${dateStr.slice(0, 7)}（月）`;
  if (granularity === "week") return `${dateStr}（週開始）`;
  return dateStr;
}

// 数値を円表記文字列にする
function formatTooltipValue(value) {
  return `${Number(value ?? 0).toLocaleString()} 円`;
}

// 日付文字列の作成
function yyyymmdd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 過去から指定日数遡る日付を作成
function rangeFromDays(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: yyyymmdd(from), to: yyyymmdd(to) };
}

export default function App() {
  // state
  const [token, setTokenState] = useState(() => localStorage.getItem("token") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [total, setTotal] = useState(0);
  const [byDay, setByDay] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rangeKey, setRangeKey] = useState("7d");
  const [range, setRange] = useState(() => rangeFromDays(7));
  const [granularity, setGranularity] = useState("day"); // day|week|month

  const [initAmount, setInitAmount] = useState("");
  const [freeAmount, setFreeAmount] = useState("");

  const [showInitModal, setShowInitModal] = useState(false);
  const [initDone, setInitDone] = useState(false);

  const [minDate, setMinDate] = useState(null);

  // 401共通処理（tokenが切れてたらログインに戻す）
  function handleUnauthorized() {
    clearToken();
    setTokenState("");
  }

  // ログイン
  async function login() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(apiUrl("/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`login failed: ${res.status} ${text}`);
      }

      const data = await res.json();
      const t = data?.token;
      if (!t) throw new Error("token not found");

      saveToken(t);          // localStorageへ保存
      setTokenState(t);      // stateへ反映
    } catch (e) {
      setError(e?.message || "login error");
    } finally {
      setLoading(false);
    }
  }

  // meta
  async function fetchMeta() {
    try {
      const res = await apiFetch("/meta");
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) return;

      const data = await res.json();
      if (data?.minDate) setMinDate(data.minDate);
    } catch {
      // 無視
    }
  }

  // summary
  async function fetchSummary(nextRange = range) {
    setError("");
    console.log("summary");
    const qs = new URLSearchParams({
      from: nextRange.from,
      to: nextRange.to,
      mode: "total",
      fill: "false",
      granularity: "auto",
    });

    const res = await apiFetch(`/summary?${qs.toString()}`);
    if (res.status === 401) return handleUnauthorized();

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`summary failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    setTotal(data.total ?? 0);
    setGranularity(data.granularity ?? "day");

    const rows = (data.byDay ?? []).map((r) => ({
      date: r.date,
      total: Number(r.total ?? 0),
    }));
    setByDay(rows);
  }

  // transaction
  async function postTransaction(amount) {
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (res.status === 401) return handleUnauthorized();

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`post failed: ${res.status} ${text}`);
      }

      await fetchSummary();
    } catch (e) {
      setError(e?.message || "error");
    } finally {
      setLoading(false);
    }
  }

  // 金額自由入力
  async function sendFreeAmount(freeAmount, sign) {
    setLoading(true);
    setError("");

    try {
      let amount = Number(freeAmount);
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("おつりは0以上の整数にしてください");
      }
      if((sign === "minus")) { amount = -amount;}

      await postTransaction(amount);

      setFreeAmount("");
       
    } catch (e) {
      setError(e?.message || "error");
    } finally {
      setLoading(false);
    }

  }
  // initial balance
  async function postInitialBalance() {
    setLoading(true);
    setError("");

    try {
      const amount = Number(initAmount);
      if (!Number.isInteger(amount) || amount < 0) {
        throw new Error("初期値は0以上の整数にしてください");
      }

      const res = await apiFetch("/initial-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (res.status === 401) return handleUnauthorized();

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`initial-balance failed: ${res.status} ${text}`);
      }

      setInitAmount("");
      await fetchSummary(range);
    } catch (e) {
      setError(e?.message || "error");
    } finally {
      setLoading(false);
    }
  }

  // 期間の変更
  async function changeRange(nextKey) {
    setRangeKey(nextKey);
    setLoading(true);

    try {
      const to = yyyymmdd(new Date());
      let nextRange;

      if (nextKey === "all") {
        nextRange = { from: minDate ?? to, to };
      } else {
        const def = RANGES.find((r) => r.key === nextKey);
        nextRange = rangeFromDays(def.days);
      }

      setRange(nextRange);
      await fetchSummary(nextRange);
    } finally {
      setLoading(false);
    }
  }

  // token がある時だけ初期ロード
  useEffect(() => {
    if (!token) return;

    fetchMeta().finally(() => {
      fetchSummary(range).catch((e) => setError(e?.message || "error"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const rangeLabel = useMemo(() => {
    const def = RANGES.find((r) => r.key === rangeKey);
    return def?.label ?? "";
  }, [rangeKey]);

  const xInterval = (() => {
    const n = byDay.length;
    if (n <= 6) return 0;
    const step = Math.ceil(n / 6);
    return step - 1;
  })();

  // ---- ログイン画面 ----
  if (!token) {
    return (
      <div className="wrap">
        <h1>貯金箱トラッカー</h1>

        <div className="card">
          <h2>ログイン</h2>

          {error && <div className="error">⚠ {error}</div>}

          <input
            className="input"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <br />
          <br />
          <input
            className="input"
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <br />
          <br />
          <br />

          <button className="btn" onClick={login} disabled={loading || !email || !password}>
            ログイン
          </button>
          <br></br>
          <p className="muted">デモアカウント:</p>
          <p className="muted">id:admin@example.com</p>
          <p className="muted">password:password123</p>
        </div>
      </div>
    );
  }

  // ---- アプリ本体 ----
  return (
    <div className="wrap">
      <h1>貯金箱トラッカー</h1>

      <div className="card">
        <div className="total">
          <div className="label">合計</div>
          <div className="value">{total.toLocaleString()} 円</div>
        </div>

        <div className="buttons">
          {AMOUNTS.map((x) => (
            <button
              key={x.label}
              onClick={() => postTransaction(x.amount)}
              disabled={loading}
              className="btn"
            >
              {x.label}
            </button>
          ))}
            <input
              className="inputFreeAmount"
              inputMode="numeric"
              placeholder="例: 485"
              value={freeAmount}
              onChange={(e) => setFreeAmount(e.target.value)}
              disabled={loading}
            />
            <p className="YenText">円</p>
            
            <button
              onClick={() => sendFreeAmount(freeAmount,"plus")}
              disabled={loading}
              className="btn"
            >
             足す
            </button>
            <button
              onClick={() => sendFreeAmount(freeAmount,"minus")}
              disabled={loading}
              className="btn"
            >
             引く
            </button>

        </div>

        <div className="rangeRow">
          <div className="rangeTabs">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={r.key === rangeKey ? "tab active" : "tab"}
                onClick={() => changeRange(r.key)}
                disabled={loading}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="muted">
            表示: {rangeLabel}（{range.from} 〜 {range.to}） / 粒度: {granularity}
          </div>
        </div>

        {error && <div className="error">⚠ {error}</div>}
      </div>

      <div className="card">
        <h2>日次残高（折線）</h2>

        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={byDay} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickMargin={8}
                interval={xInterval}
                tickFormatter={(v) => formatXAxisLabel(v, granularity)}
              />
              <YAxis tickMargin={8} />
              <Tooltip
                labelFormatter={(label) => formatTooltipLabel(label, granularity)}
                formatter={(value) => [formatTooltipValue(value), "残高"]}
              />
              <Line type="monotone" dataKey="total" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="initRow">
        <button
          className="btn warn"
          onClick={() => setShowInitModal(true)}
          disabled={loading || initDone}
        >
          初期値を設定
        </button>

        {initDone && <span className="muted">※ 初期値は設定済みです</span>}
      </div>

      {showInitModal && (
        <div className="modalOverlay">
          <div className="modal">
            <h3>初期値の設定</h3>

            <p className="modalText">
              初期値は <strong>一度だけ</strong> 設定できます。<br />
              設定後は取り消せません。
            </p>

            <input
              className="input"
              inputMode="numeric"
              placeholder="例: 20000"
              value={initAmount}
              onChange={(e) => setInitAmount(e.target.value)}
              disabled={loading}
            />

            <div className="modalActions">
              <button className="btn" onClick={() => setShowInitModal(false)} disabled={loading}>
                キャンセル
              </button>

              <button
                className="btn danger"
                disabled={loading || initAmount === ""}
                onClick={async () => {
                  await postInitialBalance();
                  setShowInitModal(false);
                  setInitDone(true);
                }}
              >
                この金額で設定
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className="btn"
        onClick={() => {
          handleUnauthorized(); // token消してログインへ
        }}
      >
        ログアウト
      </button>
    </div>
  );
}