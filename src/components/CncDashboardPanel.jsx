import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'
import { PageHeader } from './SimplePanels.jsx'

function todayText() {
  return new Date().toISOString().slice(0, 10)
}

function statusText(status) {
  const map = {
    RUNNING: '運轉中',
    IDLE: '待機',
    ALARM: '異常',
    SCHEDULED: '有排程',
    NO_DATA: '無資料',
  }
  return map[status] || status || '-'
}

function CncMachineCard({ row }) {
  return (
    <div className={`cnc-dashboard-card status-${String(row.status || '').toLowerCase()}`}>
      <div className="cnc-dashboard-card-head">
        <div>
          <div className="metric-label">{row.cnc_machine_id}</div>
          <div className="metric-value">{statusText(row.status)}</div>
        </div>
        <span className={`cnc-status-pill level-${String(row.alert_level || 'normal').toLowerCase()}`}>
          {row.alert_level || 'NORMAL'}
        </span>
      </div>

      <div className="cnc-dashboard-kv-grid">
        <div><span>目前製令</span><b>{row.current_work_order_no || '-'}</b></div>
        <div><span>成品代號</span><b>{row.current_product_no || '-'}</b></div>
        <div><span>目前步驟</span><b>{row.current_step_name || '-'}</b></div>
        <div><span>預計時間</span><b>{row.current_start_time || '-'} ~ {row.current_end_time || '-'}</b></div>
        <div><span>今日稼動</span><b>{row.scheduled_hours} / 8h</b></div>
        <div><span>稼動率</span><b>{row.utilization_rate}%</b></div>
        <div><span>功率 kW</span><b>{row.power_kw}</b></div>
        <div><span>需量 kW</span><b>{row.demand_kw}</b></div>
        <div><span>THD</span><b>{row.thd}</b></div>
        <div><span>三相不平衡</span><b>{row.phase_imbalance_rate}</b></div>
      </div>

      <div className="cnc-dashboard-reason">{row.alert_reason}</div>
    </div>
  )
}

export default function CncDashboardPanel() {
  const [scheduleDate, setScheduleDate] = useState(todayText())
  const [selectedCnc, setSelectedCnc] = useState('ALL')
  const [data, setData] = useState({ cards: [], alerts: [], description: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function load(targetDate = scheduleDate) {
    setLoading(true)
    setMessage('')
    try {
      const res = await apiClient.get(`/aips/cnc-dashboard/summary?schedule_date=${targetDate}`)
      setData(res.data || { cards: [], alerts: [] })
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'CNC Dashboard 載入失敗'
      setMessage(detail)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(scheduleDate)
  }, [])

  const cncOptions = useMemo(() => {
    const values = new Set((data.cards || []).map((row) => row.cnc_machine_id).filter(Boolean))
    return ['ALL', ...Array.from(values).sort()]
  }, [data.cards])

  const filteredCards = selectedCnc === 'ALL'
    ? data.cards || []
    : (data.cards || []).filter((row) => row.cnc_machine_id === selectedCnc)

  const filteredAlerts = selectedCnc === 'ALL'
    ? data.alerts || []
    : (data.alerts || []).filter((row) => row.cnc_machine_id === selectedCnc)

  const alertColumns = ['cnc_machine_id', 'alert_level', 'status', 'alert_reason']
  const alertLabels = {
    cnc_machine_id: 'CNC',
    alert_level: '風險等級',
    status: '狀態',
    alert_reason: '說明',
  }

  return (
    <div className="page">
      <PageHeader
        title="CNC Dashboard"
        subtitle="查看每台 CNC 目前狀態、電表資訊、目前製令、今日稼動率與產能風險；與 CNC 日排程統計分開，Dashboard 偏即時監控，日排程偏排程驗證。"
      >
        <input
          type="date"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
        />
        <select
          className="cnc-filter-select"
          value={selectedCnc}
          onChange={(e) => setSelectedCnc(e.target.value)}
        >
          {cncOptions.map((cnc) => (
            <option key={cnc} value={cnc}>{cnc === 'ALL' ? '全部 CNC' : cnc}</option>
          ))}
        </select>
        <button onClick={() => load(scheduleDate)} disabled={loading}>重新整理</button>
      </PageHeader>

      {message && <div className="export-message">操作結果：{message}</div>}

      <div className="card cnc-dashboard-diff">
        <h2>Dashboard 與日排程統計的區隔</h2>
        <div className="cnc-dashboard-diff-grid">
          <div>
            <b>CNC Dashboard</b>
            <p>看每台 CNC 目前狀態、電表 THD / 需量 / 功率、目前工單、警示與今日稼動概況。</p>
          </div>
          <div>
            <b>CNC 日排程統計</b>
            <p>檢查 08:00~16:00 的 8 小時排程結果、甘特圖、每個成品最多三個 CNC 加工步驟。</p>
          </div>
        </div>
      </div>

      <div className="cnc-dashboard-grid">
        {filteredCards.map((row) => <CncMachineCard key={row.cnc_machine_id} row={row} />)}
      </div>

      <div className="card">
        <h2>目前異常 / 風險清單</h2>
        <DataTable
          columns={alertColumns}
          labels={alertLabels}
          rows={filteredAlerts}
          defaultPageSize={10}
        />
      </div>
    </div>
  )
}
