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
import { apiUrl } from "./api";

// 貯金の種別
const AMOUNTS = [
  { label: "+500円", amount: 500 },
  { label: "-500円", amount: -500 },
  { label: "+1円", amount: 1 },
  { label: "-1円", amount: -1 },
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
  // dateStr は 'YYYY-MM-DD'
  if (!dateStr) return "";

  if (granularity === "month") {
    // 'YYYY-MM'
    return dateStr.slice(0, 7);
  }
  if (granularity === "week") {
    // 'MM/DD'（週開始日表示）
    return dateStr.slice(5).replace("-", "/");
  }
  // day: 'MM/DD'
  return dateStr.slice(5).replace("-", "/");
}

// ツールチップのラベル文言作成
function formatTooltipLabel(dateStr, granularity) {
  if (!dateStr) return "";
  if (granularity === "month") {
    // 例: 2026-02
    return `${dateStr.slice(0, 7)}（月）`;
  }
  if (granularity === "week") {
    // 例: 2026-02-03（週）
    return `${dateStr}（週開始）`;
  }
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

// アプリ本体
export default function App() {

  // state
  const [total, setTotal] = useState(0);
  const [byDay, setByDay] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rangeKey, setRangeKey] = useState("7d");
  const [range, setRange] = useState(() => rangeFromDays(7));
  const [granularity, setGranularity] = useState("day"); // day|week|month
  const [initAmount, setInitAmount] = useState("");
  const [showInitModal, setShowInitModal] = useState(false);
  const [initDone, setInitDone] = useState(false); // 初期値設定済みフラグ
  
  // 全期間用：最古日付をAPIからもらう（なければ今日）
  const [minDate, setMinDate] = useState(null);

  // meta apiを呼ぶ (1件データがあるかを確認)
  async function fetchMeta() {

    try {
      const res = await fetch(apiUrl("/api/meta"));
      if (!res.ok) return;
      const data = await res.json();
      if (data?.minDate) setMinDate(data.minDate);
    } catch {
      // 無視
    }
  }

  // summary apiを呼ぶ(データの取得)
  async function fetchSummary(nextRange = range) {

    setError("");

    // GETパラメータをまとめる
    const qs = new URLSearchParams({
      from: nextRange.from,
      to: nextRange.to,
      mode: "total",
      fill: "false",
      granularity: "auto",
    });

    const res = await fetch(apiUrl(`/api/summary?${qs.toString()}`));

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`summary failed: ${res.status} ${text}`);
    }

    // 引いてきたデータをstateにセット
    const data = await res.json();
    setTotal(data.total ?? 0);
    setGranularity(data.granularity ?? "day");

    const rows = (data.byDay ?? []).map((r) => ({
      date: r.date,
      total: Number(r.total ?? 0),
    }));
    setByDay(rows);
  }

  // transaction api呼び出し（金額をDBに登録）

  async function postTransaction(amount) {

    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/transactions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`post failed: ${res.status} ${text}`);
      }
      await fetchSummary();   // summaryを再取得
    } catch (e) {
      setError(e.message || "error");
    } finally {
      setLoading(false);
    }
  }

  // 初期金額APIを呼ぶ
  async function postInitialBalance() {

    setLoading(true);
    setError("");

    try {
      const amount = Number(initAmount);
      if (!Number.isInteger(amount) || amount < 0) {
        throw new Error("初期値は0以上の整数にしてください");
      }

      const res = await fetch(apiUrl("/api/initial-balance"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`initial-balance failed: ${res.status} ${text}`);
      }

      setInitAmount("");
      await fetchSummary(range);
    } catch (e) {
      setError(e.message || "error");
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
      const def = RANGES.find(r => r.key === nextKey);
      nextRange = rangeFromDays(def.days);
    }

    setRange(nextRange);
    await fetchSummary(nextRange); // 期間を変更してデータを再取得
  } finally {
    setLoading(false);
  }
}

// meta APIを呼び終わって、1件データがあったらsummaryを取得 
useEffect(() => {
  fetchMeta().finally(() => {
    fetchSummary(range).catch((e) => setError(e.message || "error"));
  });
}, []);

  // minDate が取得できたら、全期間押した時に効く（初回は押すまで不要）
  const rangeLabel = useMemo(() => {
    const def = RANGES.find((r) => r.key === rangeKey);
    return def?.label ?? "";
  }, [rangeKey]);

  // X軸のラベルの数を設定
  const xInterval = (() => {
    const n = byDay.length;

    // 少なければ全部表示
    if (n <= 6) return 0;

    // 目盛りを最大12個くらいにしたい
    const step = Math.ceil(n / 6);

    // rechartsの interval は「何個飛ばすか」なので step-1
    return step - 1;
  })();
  
  

  return (

    <div className="wrap">
      <h1>貯金箱トラッカー</h1>

      <div className="card">
        <div className="total">
          <div className="label">合計</div>
          <div className="value">{total.toLocaleString()} 円</div>
        </div>

        <div className="buttons">
          {/* 金種リスト分のボタンを生成 */}
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

        {initDone && (
          <span className="muted">※ 初期値は設定済みです</span>
        )}
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
              <button
                className="btn"
                onClick={() => setShowInitModal(false)}
                disabled={loading}
              >
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
    </div>

  );
}