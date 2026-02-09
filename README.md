# 貯金箱トラッカー(フロントエンド)

## システム概要
貯金箱に入れたお金の増減を、シンプルに記録・可視化するためのフロントエンドアプリです。<br>
「今日は500円入れた」「1円だけ使った」といった日々の小さな変化を、API経由で保存し、折れ線グラフとして確認できます。<br>

PWAとして構築しており、スマートフォンではホーム画面に追加して常用アプリのように利用できます。<br>
オフライン時の挙動やキャッシュ制御も考慮し、Service Worker を用いた実装を行っています。<br>

### 主な特徴
*	金額（+500 / -500 / +1 / -1）のワンタップ記録
*	日次残高の折れ線グラフ表示
*	表示期間の切り替え（1週間 / 1ヶ月 / 3ヶ月 / 半年 / 1年 / 全期間）
*	初期値設定機能（初回のみ）
*	PWA対応（ホーム画面追加・キャッシュ制御）
*	バックエンドAPIと分離したSPA構成

本プロジェクトは、<br>
React + Vite によるフロントエンド実装、API連携、PWA化、AWS上での公開までを一通り行うことを目的とした、フルスタック練習兼ポートフォリオ作品です。<br>

## 動作確認方法
環境：Node.js v20 以上<br>

    npm i
    npm run dev

## バックエンドリポジトリ
https://github.com/Sharelatte/piggybank_backend

## テーブル定義書
https://docs.google.com/spreadsheets/d/1E0vP6wubI-mgmJrogzwDUbSaqkyfmjPfYDS3aaDuA5g/edit?usp=drive_link

## API仕様書
https://docs.google.com/document/d/12SMf-XWN5fF7Q2O7qsiqUoeBatr-o-LVnso8CBylRd8/edit?usp=drive_link

## お問い合わせ
不具合報告・改善提案は GitHub Issues からお願いします。
