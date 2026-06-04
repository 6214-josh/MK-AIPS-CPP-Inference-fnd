import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'
import { PageHeader, showError } from './SimplePanels.jsx'

export function Dashboard() {
  const [summary, setSummary] = useState({})
  const latestActions = summary.latest_actions || []
  async function load(){ setSummary((await apiClient.get('/dashboard/summary')).data || {}) }
  const [flowMessage, setFlowMessage] = useState('')
  async function runFullFlow(){
    setFlowMessage('正在執行 AIPS 1-10 全流程，請稍候...')
    try {
      // FIX66：
      // 總覽頁「一鍵執行 AIPS 流程」改成呼叫 FIX64 的全流程 API。
      // 會跑：Step1 硬體資料 → Step2 資料工程 → Step3~10 → Reward 回饋循環。
      const res = await apiClient.post('/aips/data-engineering/run-full-flow')
      setFlowMessage(res.data?.message || 'AIPS 1-10 全流程執行完成')
    } catch (err) {
      // 若後端尚未套用 FIX64，保留舊流程當 fallback，避免按鈕完全失效。
      await apiClient.post('/meter/electric/demo-all').catch(()=>{})
      await apiClient.post('/meter/features/calculate/CNC-01').catch(()=>{})
      await apiClient.post('/meter/features/calculate/CNC-02').catch(()=>{})
      await apiClient.post('/meter/features/calculate/CNC-03').catch(()=>{})
      await apiClient.post('/aips/states/build').catch(()=>{})
      await apiClient.post('/aips/dqn/generate-actions').catch(()=>{})
      await apiClient.post('/aips/predictions/run').catch(()=>{})
      await apiClient.post('/aips/rewards/calculate').catch(()=>{})
      setFlowMessage('後端全流程 API 尚未可用，已改用舊版流程 fallback 執行')
    }
    await load()
  }
  function toPercent(v){ return `${(Number(v || 0)*100).toFixed(0)}%` }
  function actionClass(a){ const name=a.action_name||'', reason=a.action_reason||''; if(name.includes('補料')||reason.includes('缺料'))return'danger'; if(name.includes('保養')||reason.includes('異常'))return'warning'; if(name.includes('維持'))return'success'; return '' }
  useEffect(()=>{ load() }, [])
  const actionColumns=['action_id','action_time','action_name','work_order_no','original_cnc_machine_id','expected_oee_improvement_rate','action_confidence_score','action_reason']
  const actionLabels={action_id:'編號',action_time:'時間',action_name:'建議動作',work_order_no:'製令單',original_cnc_machine_id:'CNC 機台',expected_oee_improvement_rate:'預估 OEE 改善',action_confidence_score:'信心分數',action_reason:'建議原因'}
  return <div className="page"><PageHeader title="AIPS / MK-AIPS 智慧排程總覽" subtitle="整合 CNC 智慧電表、ERP 製令單、WMS 線邊庫資料，建立 DQN State，產生排程建議與 Reward 回饋。"><button className="primary-btn" onClick={runFullFlow}>一鍵執行 AIPS 流程</button><button onClick={load}>重新整理</button></PageHeader>{flowMessage&&<div className="export-message">操作結果：{flowMessage}</div>}<div className="metric-grid dashboard-metric-grid">{[
    ['ERP 已處理', summary.erp_processed_count, `AIPS 已處理 / 已回傳 ERP，總數 ${summary.erp_total_count || summary.work_order_progress_snapshot || 0}`],
    ['ERP 未處理', summary.erp_unprocessed_count, `ERP 已送入、尚未完成處理，總數 ${summary.erp_total_count || summary.work_order_progress_snapshot || 0}`],
    ['CNC 電表資料', summary.cnc_meter_raw_data, '智慧電表原始回傳筆數'],
    ['WMS 線邊庫', summary.line_side_inventory_snapshot, '線邊庫庫存快照筆數'],
    ['DQN 排程Action', summary.aips_dqn_action_log, 'AI 已產生的建議數']
  ].map(x=><div className="metric-card" key={x[0]}><div className="metric-label">{x[0]}</div><div className="metric-value">{x[1]||0}</div><div className="metric-hint">{x[2]}</div></div>)}</div><div className="card"><h2>AI 排程流程</h2><div className="flow-grid">{['資料收集|CNC 電力、ERP 製令單、WMS 線邊庫庫存。','特徵工程|計算功率、THD、機台狀態、缺料風險。','DQN State|整合設備、工單、庫存、交期、OEE 狀態。','排程建議|提前補料、提高優先權、換機、預防保養。'].map((s,i)=>{const [a,b]=s.split('|');return <div className="flow-step" key={a}><strong>{i+1}. {a}</strong><span>{b}</span></div>})}</div></div><div className="card"><h2>最新建議</h2><div className="action-list">{latestActions.length===0?<div className="action-card">目前尚未產生 DQN 建議，請先按「一鍵執行 AIPS 流程」。</div>:latestActions.map(a=><div key={a.action_id} className={`action-card ${actionClass(a)}`}><div className="action-title"><div>{a.action_name||a.action_type}</div><span className="badge">信心 {toPercent(a.action_confidence_score)}</span></div><div className="action-meta">製令單：{a.work_order_no||'-'}　機台：{a.original_cnc_machine_id||'-'}　預估 OEE 改善：{toPercent(a.expected_oee_improvement_rate)}</div><div className="action-reason">{a.action_reason||'尚無建議原因'}</div></div>)}</div></div><div className="card"><h2>技術資料表</h2><DataTable columns={actionColumns} rows={latestActions} labels={actionLabels}/></div></div>
}

export function WorkOrderPanel() {
  const [rows,setRows]=useState([])
  const [form,setForm]=useState({work_order_no:'WO-202606-001',product_no:'P-AXLE-001',product_name:'軸心零件',process_code:'CNC-MILLING',planned_qty:100,completed_qty:20,good_qty:20,ng_qty:0,remaining_qty:80,priority_level:8,assigned_cnc_machine_id:'CNC-01',estimated_remaining_hours:8,due_date_text:'2026-06-03 18:00:00',current_process_status:'PROCESSING'})
  const columns=['snapshot_id','snapshot_time','work_order_no','product_no','product_name','process_code','planned_qty','completed_qty','remaining_qty','due_date','priority_level','assigned_cnc_machine_id','delay_risk_flag']
  const labels={snapshot_id:'編號',snapshot_time:'時間',work_order_no:'製令單',product_no:'產品',product_name:'品名',process_code:'工序',planned_qty:'計畫量',completed_qty:'完成量',remaining_qty:'剩餘',due_date:'交期',priority_level:'優先',assigned_cnc_machine_id:'CNC',delay_risk_flag:'延遲風險'}
  function update(k,v){ setForm(p=>({...p,[k]:v})) }
  function toIsoDate(text){ const d=new Date(String(text).replace(' ','T')); return isNaN(d.getTime())?null:d.toISOString() }
  async function create(){ const payload={...form,due_date:toIsoDate(form.due_date_text)}; delete payload.due_date_text; await apiClient.post('/work-orders/snapshots', payload); await load() }
  async function load(){ setRows((await apiClient.get('/work-orders/snapshots/latest')).data||[]) }
  useEffect(()=>{load()},[])
  const fields=[['work_order_no','製令單號'],['product_no','產品料號'],['product_name','產品名稱'],['process_code','工序'],['planned_qty','計畫數量','number'],['completed_qty','完成數量','number'],['good_qty','良品','number'],['ng_qty','不良','number'],['remaining_qty','剩餘數量','number'],['priority_level','優先權','number'],['assigned_cnc_machine_id','指派 CNC'],['estimated_remaining_hours','預估剩餘小時','number'],['due_date_text','交期'],['current_process_status','狀態']]
  return <div className="page"><PageHeader title="ERP 製令單"><button className="primary-btn" onClick={create}>新增製令單</button><button onClick={load}>重新整理</button></PageHeader><div className="card"><h2>新增製令單資料</h2><div className="form-grid">{fields.map(([k,label,type])=><label key={k}>{label}<input value={form[k]} type={type||'text'} onChange={e=>update(k,type==='number'?Number(e.target.value):e.target.value)} /></label>)}</div></div><div className="card"><h2>製令單清單</h2><DataTable columns={columns} rows={rows} labels={labels}/></div></div>
}

export function InventoryPanel() {
  const [rows,setRows]=useState([])
  const [form,setForm]=useState({cnc_machine_id:'CNC-01',line_side_location_id:'LS-CNC-01',material_no:'MAT-AL-6061',material_name:'鋁棒 6061',lot_no:'LOT-A1',current_qty:80,reserved_qty:10,safety_stock_qty:20})
  const columns=['snapshot_id','snapshot_time','cnc_machine_id','line_side_location_id','material_no','material_name','lot_no','current_qty','reserved_qty','available_qty','safety_stock_qty','shortage_flag','shortage_qty','replenishment_required_flag']
  const labels={snapshot_id:'編號',snapshot_time:'時間',cnc_machine_id:'CNC',line_side_location_id:'線邊庫',material_no:'物料',material_name:'名稱',lot_no:'批號',current_qty:'現有',reserved_qty:'保留',available_qty:'可用',safety_stock_qty:'安全庫存',shortage_flag:'缺料',shortage_qty:'缺料量',replenishment_required_flag:'需補料'}
  function update(k,v){ setForm(p=>({...p,[k]:v})) }
  async function create(){ await apiClient.post('/inventory/snapshots', form); await load() }
  async function load(){ setRows((await apiClient.get('/inventory/snapshots/latest')).data||[]) }
  useEffect(()=>{load()},[])
  const fields=[['cnc_machine_id','CNC'],['line_side_location_id','線邊庫'],['material_no','物料編號'],['material_name','物料名稱'],['lot_no','批號'],['current_qty','目前數量','number'],['reserved_qty','保留數量','number'],['safety_stock_qty','安全庫存','number']]
  return <div className="page"><PageHeader title="WMS 線邊庫"><button className="primary-btn" onClick={create}>新增庫存快照</button><button onClick={load}>重新整理</button></PageHeader><div className="card"><h2>新增線邊庫資料</h2><div className="form-grid">{fields.map(([k,label,type])=><label key={k}>{label}<input value={form[k]} type={type||'text'} onChange={e=>update(k,type==='number'?Number(e.target.value):e.target.value)} /></label>)}</div></div><div className="card"><h2>線邊庫清單</h2><DataTable columns={columns} rows={rows} labels={labels}/></div></div>
}
