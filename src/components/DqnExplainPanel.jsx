import React, { useEffect, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'

export default function DqnExplainPanel() {
  const [variables, setVariables] = useState([])
  const [actions, setActions] = useState([])
  const [rewardFormula, setRewardFormula] = useState({})
  const [results, setResults] = useState([])

  const variableColumns = ['name', 'label', 'meaning', 'source']
  const variableLabels = {
    name: '變數名稱',
    label: '中文名稱',
    meaning: 'DQN 用途',
    source: '資料來源'
  }

  const actionColumns = ['action_code', 'action_name', 'trigger', 'event']
  const actionLabels = {
    action_code: 'Action Code',
    action_name: 'Action',
    trigger: '觸發條件',
    event: '系統事件'
  }

  async function loadOverview() {
    const res = await apiClient.get('/aips/dqn-explain/overview')
    setVariables(res.data.variables || [])
    setActions(res.data.actions || [])
    setRewardFormula(res.data.reward_formula || {})
    setResults(res.data.demo_results || [])
  }

  async function simulate() {
    const res = await apiClient.post('/aips/dqn-explain/simulate', {
      items: results.map((r) => r.input_state)
    })
    setResults(res.data.results || [])
  }

  useEffect(() => {
    loadOverview()
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">DQN 決策說明 / Reward 展開</h1>
          <p className="page-subtitle">
            展示 DQN 接收哪些變數、如何計算 Reward 分數，以及高分 / 低分如何觸發加工、補料、停機、換機台等 Action。
          </p>
        </div>
        <div className="toolbar">
          <button className="primary-btn" onClick={loadOverview}>重新載入說明</button>
          <button onClick={simulate}>重新計算 Reward</button>
        </div>
      </div>

      <div className="explain-banner">
        DQN會把 ERP 製令、流程卡工序、CNC 智慧電表、WMS 線邊庫存轉成 State Vector，
        再比較每個 Action 的 Reward / Q Value，最後選擇分數最高的事件。
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">CNC 數量</div>
          <div className="metric-value">3</div>
          <div className="metric-hint">CNC-01 / CNC-02 / CNC-03</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">State 變數</div>
          <div className="metric-value">{variables.length}</div>
          <div className="metric-hint">DQN 接收的輸入變數</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Action 數量</div>
          <div className="metric-value">{actions.length}</div>
          <div className="metric-hint">加工 / 補料 / 停機 / 換機台</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Reward 範圍</div>
          <div className="metric-value">0~100</div>
          <div className="metric-hint">越高越優先觸發</div>
        </div>
      </div>

      <section className="card">
        <h2>a. DQN 接收變數</h2>
        <p className="section-note">
          以下變數會組成 State Vector，例如：
          <code>[交期剩餘, 預估加工, OEE, 缺料風險, 電力風險, 品質風險, 前置工序完成]</code>
        </p>
        <DataTable columns={variableColumns} rows={variables} labels={variableLabels} />
      </section>

      <section className="card">
        <h2>b. DQN 如何提升 CNC 控制效率與性能</h2>
        <div className="flow-grid">
          <div className="flow-box">
            <h3>1. 避免錯誤加工</h3>
            <p>工序未完成時，立即加工會被扣高額 reward，避免步驟 2 在步驟 1 未完成前被派工。</p>
          </div>
          <div className="flow-box">
            <h3>2. 提升稼動率</h3>
            <p>OEE 高的 CNC 會提高「立即加工」分數；OEE 低時會考慮換 CNC。</p>
          </div>
          <div className="flow-box">
            <h3>3. 降低缺料等待</h3>
            <p>缺料風險高時，DQN 會觸發補料，而不是讓 CNC 空等。</p>
          </div>
          <div className="flow-box">
            <h3>4. 降低異常停機</h3>
            <p>THD / 功率風險高時，DQN 會建議停機檢查，避免硬做造成更大損失。</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>c. Action 與觸發事件</h2>
        <DataTable columns={actionColumns} rows={actions} labels={actionLabels} />
      </section>

      <section className="card">
        <h2>d. Reward 計算公式</h2>
        <p className="section-note">
          Reward 是 0~100 分。分數越高，代表此 Action 在目前 State 下越值得執行。
          實際 DQN 會學 Q Value；此頁用可解釋公式展示「為什麼它會選這個 Action」。
        </p>
        <div className="formula-list">
          {Object.entries(rewardFormula).map(([key, formula]) => (
            <div className="formula-item" key={key}>
              <strong>{key}</strong>
              <span>{formula}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>三台 CNC + 工序關係範例</h2>
        <p className="section-note">
          若流程卡是「步驟1 → 步驟2 → 步驟3」，則後一步必須等前一步完成。
          若三台 CNC 可平行加工，DQN 會比較每台 CNC 的 Reward，選最高分 Action。
        </p>

        <div className="cnc-grid">
          {results.map((row) => (
            <div key={row.cnc_id} className="cnc-card">
              <div className="cnc-title">{row.cnc_id}｜{row.current_step}</div>
              <div className="best-action">{row.best_action_name}</div>
              <div className="state-line">State Vector：{(row.state_vector || []).join(' / ')}</div>

              <div className="reward-bars">
                {Object.entries(row.reward_scores || {}).map(([action, score]) => (
                  <div className="reward-row" key={action}>
                    <span className="reward-name">{action}</span>
                    <div className="bar">
                      <div className="bar-inner" style={{ width: `${score}%` }} />
                    </div>
                    <span className="reward-score">{score}</span>
                  </div>
                ))}
              </div>

              <div className="explain-small">
                交期壓力={row.explain?.due_pressure}，
                前置未完成懲罰={row.explain?.dependency_penalty}，
                缺料={row.explain?.shortage_risk}，
                電力={row.explain?.power_thd_risk}，
                品質={row.explain?.quality_risk}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="speech-box">
          本系統的 DQN State 包含交期剩餘時間、LSTM/ARIMA 預估加工時間、CNC OEE、線邊庫缺料風險、智慧電表 THD 風險、品質風險與工序前置關係。
          DQN 會針對「立即加工、等待前工序、補料、停機維護、換 CNC、提高優先權」計算 Reward / Q Value。
          分數最高者會成為建議 Action，因此可同時兼顧交期、稼動率、缺料、品質與設備風險。
        </div>
      </section>
    </div>
  )
}
