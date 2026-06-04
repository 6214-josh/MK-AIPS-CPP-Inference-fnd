import React, { useEffect, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'
import { PageHeader, showError } from './SimplePanels.jsx'

export default function RunCardPanel(){
  const [headers,setHeaders]=useState([]),[details,setDetails]=useState([]),[features,setFeatures]=useState([]),[suggestions,setSuggestions]=useState([])
  const [dqnActionTotal,setDqnActionTotal]=useState(0)
  const [selectedRunCardId,setSelectedRunCardId]=useState('')
  const [result,setResult]=useState('')
  const [aiStatus,setAiStatus]=useState({})
  const [form,setForm]=useState({run_card_no:'MK20240069',production_batch_no:'MK20260111003',work_order_no:'WO-RUNCARD-DEMO',customer_name:'UMC',product_no:'MK030001',material_no:'3D10-260318-11',piece_id:'A123-456-789',serial_no:'20260401 ZH-260318'})
  const headerColumns=['run_card_id','run_card_no','production_batch_no','work_order_no','customer_name','product_no','material_no','planned_qty','remaining_qty','due_date','priority_level','run_card_status']
  const detailColumns=['sequence_no','station_name','station_sub_name','process_type','cnc_machine_id','planned_qty','control_spec_text','standard_cycle_time_sec','delay_minutes','shortage_flag','avg_power_kw','avg_thd_current','quality_risk_score','detail_status']
  const featureColumns=['feature_id','work_order_no','station_name','cnc_machine_id','arima_predicted_minutes','lstm_predicted_minutes','delay_risk_score','shortage_risk_score','quality_risk_score','power_risk_score']
  const suggestionColumns=['action_id','action_time','work_order_no','cnc_machine_id','action_type','action_name','reason','action_status']
  function update(k,v){ setForm(p=>({...p,[k]:v})) }
  async function loadDqnActions(){
    const rows=(await apiClient.get('/run-cards/dqn/actions')).data||[]
    setSuggestions(rows)
    try {
      const summary=(await apiClient.get('/run-cards/dqn/actions/summary')).data||{}
      setDqnActionTotal(summary.total_count ?? rows.length)
    } catch {
      setDqnActionTotal(rows.length)
    }
  }
  async function loadAiStatus(){ setAiStatus((await apiClient.get('/run-cards/ai/status')).data||{}) }
  async function load(){ const h=(await apiClient.get('/run-cards/headers')).data||[]; setHeaders(h); setFeatures((await apiClient.get('/run-cards/features')).data||[]); await loadDqnActions(); await loadAiStatus(); if(h.length && !selectedRunCardId){ setSelectedRunCardId(String(h[0].run_card_id)); await loadDetail(h[0].run_card_id) } }
  async function loadDetail(id=selectedRunCardId){ if(!id)return; const res=await apiClient.get(`/run-cards/headers/${id}`); setDetails(res.data.details||[]) }
  async function createHeader(){ const res=await apiClient.post('/run-cards/headers', form); setResult(`已新增單頭 ${res.data.run_card_id}`); await load() }
  async function createDemo(){ const res=await apiClient.post('/run-cards/demo'); setResult(`已產生 Demo：${res.data.run_card_id}`); await load() }
  async function autoCreateDetails(){ const res=await apiClient.post('/run-cards/details/auto-create'); setResult(`已產生 ${res.data.created||0} 筆單身`); await load() }
  async function generateFeatures(){ const res=await apiClient.post('/run-cards/features/generate'); setResult(`已產生 ${res.data.created||0} 筆 AI 特徵`); await load() }
  async function generateDqn(){
    const res=await apiClient.post('/run-cards/dqn/suggest')
    const created = res.data.created_count ?? res.data.created ?? (res.data.suggestions?.length || 0)
    const featureCreated = res.data.feature_created ?? res.data.feature_result?.created ?? 0
    const detailCreated = res.data.auto_created_detail_count ?? res.data.feature_result?.auto_created_detail_count ?? 0
    setResult(res.data.message || `已新增 ${created} 筆 DQN 建議（本次新增 AI 特徵 ${featureCreated} 筆，自動補單身 ${detailCreated} 筆）`)
    await load()
  }
  useEffect(()=>{load()},[])
  useEffect(()=>{ if(selectedRunCardId) loadDetail(selectedRunCardId) },[selectedRunCardId])
  const statusText = `PyTorch=${aiStatus.pytorch?'已啟用':'未啟用'}${aiStatus.torch_version?` (${aiStatus.torch_version})`:''}，statsmodels ARIMA=${aiStatus.statsmodels?'已啟用':'未啟用'}${aiStatus.statsmodels_version?` (${aiStatus.statsmodels_version})`:''}`
  const fields=[['run_card_no','流程卡號'],['production_batch_no','生產批號'],['work_order_no','製令單號'],['customer_name','客戶名稱'],['product_no','產品料號'],['material_no','物料編號'],['piece_id','Piece ID'],['serial_no','S/N']]
  return <div className="page"><PageHeader title="製令流程卡 / AI 排程資料" subtitle="依「生產流程卡」格式建立單頭、單身，並產生 LSTM / ARIMA 特徵與 DQN 排程Action。"><button className="primary-btn" onClick={createDemo}>新增流程卡 Demo</button><button onClick={autoCreateDetails}>補齊單身</button><button onClick={generateFeatures}>產生 LSTM / ARIMA 特徵</button><button onClick={generateDqn}>產生 DQN 建議</button><button onClick={load}>重新整理</button></PageHeader><div className="card"><strong>AI 引擎狀態：</strong><div>{statusText}</div></div>{result&&<div className="export-message">操作結果：{result}</div>}<div className="metric-grid"><div className="metric-card"><div className="metric-label">流程卡單頭</div><div className="metric-value">{headers.length}</div><div className="metric-hint">AIPS_RUN_CARD_HEADER</div></div><div className="metric-card"><div className="metric-label">AI 特徵</div><div className="metric-value">{features.length}</div><div className="metric-hint">LSTM / ARIMA Feature</div></div><div className="metric-card"><div className="metric-label">DQN 建議</div><div className="metric-value">{dqnActionTotal}</div><div className="metric-hint">Action Suggestion（表格顯示最近 {suggestions.length} 筆）</div></div></div><div className="card"><h2>新增流程卡單頭</h2><div className="form-grid">{fields.map(([k,l])=><label key={k}>{l}<input value={form[k]} onChange={e=>update(k,e.target.value)} /></label>)}</div><button className="primary-btn" onClick={createHeader}>新增單頭</button></div><div className="card"><h2>流程卡單頭</h2><DataTable columns={headerColumns} rows={headers}/></div><div className="card"><h2>目前選取流程卡單身</h2><select value={selectedRunCardId} onChange={e=>setSelectedRunCardId(e.target.value)}>{headers.map(h=><option key={h.run_card_id} value={h.run_card_id}>{h.run_card_no} / {h.work_order_no}</option>)}</select><DataTable columns={detailColumns} rows={details}/></div><div className="card"><h2>LSTM / ARIMA 特徵</h2><DataTable columns={featureColumns} rows={features}/></div><div className="card"><h2>DQN 排程建議</h2><DataTable columns={suggestionColumns} rows={suggestions}/></div></div>
}
