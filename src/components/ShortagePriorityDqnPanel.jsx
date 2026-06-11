import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'

const SHORTAGE_CNC_OPTIONS = ['ALL', ...Array.from({ length: 14 }, (_, i) => `CNC-${String(i + 1).padStart(2, '0')}`)]
const toPercent3 = (value) => `${(Number(value || 0) * 100).toFixed(3)}%`

function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="toolbar">{children}</div>
    </div>
  )
}

function Metric({ label, value, hint }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-hint">{hint}</div>
    </div>
  )
}

export default function ShortagePriorityDqnPanel() {
  const [summary, setSummary] = useState({})
  const [explain, setExplain] = useState({})
  const [decisions, setDecisions] = useState([])
  const [message, setMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [selectedCnc, setSelectedCnc] = useState('ALL')
  const [decisionCnc, setDecisionCnc] = useState('ALL')

  async function apiGet(primaryUrl, fallbackUrl) {
    try {
      return await apiClient.get(primaryUrl)
    } catch (err) {
      if (err?.response?.status === 404 || String(err?.response?.data?.detail || err.message || '').includes('Not found')) {
        return await apiClient.get(fallbackUrl)
      }
      throw err
    }
  }

  async function apiPost(primaryUrl, fallbackUrl) {
    try {
      return await apiClient.post(primaryUrl)
    } catch (err) {
      if (err?.response?.status === 404 || String(err?.response?.data?.detail || err.message || '').includes('Not found')) {
        return await apiClient.post(fallbackUrl)
      }
      throw err
    }
  }

  const decisionColumns = [
    'decision_id',
    'work_order_no',
    'product_no',
    'cnc_machine_id',
    'customer_shortage_risk_score',
    'line_side_shortage_qty',
    'shortage_qty',
    'due_date_remaining_hours',
    'selected_action_name',
    'selected_q_value',
    'decision_reason',
  ]

  const decisionLabels = {
    decision_id: '決策ID',
    work_order_no: '製令單',
    product_no: '產品',
    cnc_machine_id: 'CNC',
    customer_shortage_risk_score: '客戶缺貨風險',
    line_side_shortage_qty: '線邊缺料量',
    shortage_qty: '缺貨量',
    due_date_remaining_hours: '交期剩餘小時',
    selected_action_name: '最佳 Action',
    selected_q_value: 'Q Value',
    decision_reason: '決策原因',
  }

  const actionRows = useMemo(() => explain.actions || [], [explain])
  const weightRows = useMemo(() => (
    Object.entries(explain.weights || {}).map(([key, value]) => ({ key, value }))
  ), [explain])
  const displayDecisions = useMemo(() => (decisionCnc === 'ALL' ? decisions : decisions.filter(row => row.cnc_machine_id === decisionCnc)).map(row => ({
    ...row,
    customer_shortage_risk_score: toPercent3(row.customer_shortage_risk_score),
    avg_oee: row.avg_oee !== undefined ? toPercent3(row.avg_oee) : row.avg_oee,
    quality_risk_score: row.quality_risk_score !== undefined ? toPercent3(row.quality_risk_score) : row.quality_risk_score,
  })), [decisions, decisionCnc])

  async function load() {
    const [summaryRes, decisionsRes, explainRes] = await Promise.all([
      apiGet(`/aips/shortage-priority-dqn/summary?cnc_machine_id=${selectedCnc}`, `/aips/dqn/shortage-priority/summary?cnc_machine_id=${selectedCnc}`),
      apiGet(`/aips/shortage-priority-dqn/decisions/latest?limit=200&cnc_machine_id=${selectedCnc}`, `/aips/dqn/shortage-priority/decisions/latest?limit=200&cnc_machine_id=${selectedCnc}`),
      apiGet('/aips/shortage-priority-dqn/explain', '/aips/dqn/shortage-priority/explain'),
    ])
    const loadedSummary = summaryRes.data || {}
    const loadedDecisions = decisionsRes.data || []
    setSummary(loadedSummary)
    setDecisions(loadedDecisions)
    setExplain(explainRes.data || {})
    if (!loadedDecisions.length && Number(loadedSummary.total_count || 0) === 0) {
      setMessage('目前尚未建立缺貨優先 DQN 決策，請按「執行缺貨優先 DQN」產生資料。')
    }
  }

  async function run() {
    setRunning(true)
    setMessage('')
    try {
      const res = await apiPost('/aips/shortage-priority-dqn/run?limit=14&write_action=true', '/aips/dqn/shortage-priority/run?limit=14&write_action=true')
      setMessage(res.data.message || '缺貨優先 DQN 已完成')
      await load()
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || '缺貨優先 DQN 執行失敗'
      setMessage(detail)
      alert(detail)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    load().catch((err) => setMessage(err?.response?.data?.detail || err.message))
  }, [selectedCnc])

  return (
    <div className="page">
      <PageHeader
        title="缺貨優先智慧排程 DQN"
        subtitle="依 AIPS「DQN缺貨優先智慧排程計算模組」：不缺貨 > 準時交貨 > 線邊庫不中斷 > OEE 提升 > 降低能耗。"
      >
        <select value={selectedCnc} className="select-control" onChange={e=>{setSelectedCnc(e.target.value); setDecisionCnc(e.target.value)}}>
          {SHORTAGE_CNC_OPTIONS.map((cnc,index)=><option key={`shortage-cnc-${cnc}-${index}`} value={cnc}>{cnc==='ALL'?'全部 CNC':cnc}</option>)}
        </select>
        <button className="primary-btn" onClick={run} disabled={running}>
          {running ? '計算中...' : '執行缺貨優先 DQN'}
        </button>
        <button onClick={load}>重新整理</button>
      </PageHeader>

      {message && <div className="export-message">操作結果：{message}</div>}

      <div className="metric-grid">
        <Metric label="缺貨優先決策" value={summary.total_count || 0} hint="aips_shortage_priority_decision" />
        <Metric label="平均缺貨風險" value={`${Number(summary.avg_shortage_risk_percent ?? (Number(summary.avg_shortage_risk || 0) * 100)).toFixed(3)}%`} hint="越高越優先生產 / 補料" />
        <Metric label="最高缺貨風險" value={`${Number(summary.max_shortage_risk_percent ?? (Number(summary.max_shortage_risk || 0) * 100)).toFixed(3)}%`} hint="目前最危險工單" />
        <Metric label="高風險工單" value={summary.high_risk_count || 0} hint="缺貨風險 >= 0.7" />
      </div>

      <div className="card shortage-priority-banner">
        <h2>模組定位</h2>
        <div className="priority-flow">
          {(explain.positioning || []).map((item, index) => (
            <div key={`priority-position-${item}-${index}`} className="priority-box">{item}</div>
          ))}
        </div>
        <p className="section-note">
          既有 DQN 計算仍保留 GPU / Python 推論，但會再套用缺貨優先權重，避免模型只追求 OEE 卻造成客戶缺貨。
        </p>
      </div>

      <div className="card">
        <div className="card-title-row"><h2>最新缺貨優先 DQN 決策</h2><select value={decisionCnc} className="select-control cnc-nowrap" onChange={e=>setDecisionCnc(e.target.value)}>{SHORTAGE_CNC_OPTIONS.map((cnc,index)=><option key={`shortage-decision-cnc-${cnc}-${index}`} value={cnc}>{cnc==='ALL'?'全部 CNC':cnc}</option>)}</select></div>
        <DataTable columns={decisionColumns} labels={decisionLabels} rows={displayDecisions} defaultPageSize={10} />
      </div>

      <div className="card">
        <h2>Action 設計</h2>
        <DataTable
          columns={['action_type', 'action_name']}
          labels={{ action_type: 'Action Type', action_name: 'Action 名稱' }}
          rows={actionRows}
          pageable={false}
        />
      </div>

      <div className="card">
        <h2>Reward / 權重設計</h2>
        <p className="section-note">{explain.formula}</p>
        <DataTable
          columns={['key', 'value']}
          labels={{ key: '權重項目', value: '分數' }}
          rows={weightRows}
          pageable={false}
        />
      </div>

      <div className="card">
        <h2>State 特徵</h2>
        <div className="tag-list">
          {(explain.state_features || []).map((item, index) => <span key={`state-feature-${item}-${index}`} className="tag-pill">{item}</span>)}
        </div>
      </div>
    </div>
  )
}
