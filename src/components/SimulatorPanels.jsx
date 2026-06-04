import React, { useEffect, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'
import { PageHeader, showError } from './SimplePanels.jsx'

export function PdaAndroidSimulator(){
  const [devices,setDevices]=useState([]), [scans,setScans]=useState([])
  const deviceColumns=['pda_id','device_code','device_name','device_type','wifi_ssid','ip_address','operator_id','online_flag','last_scan_time']
  const scanColumns=['scan_event_id','scan_time','scan_type','scan_code','operator_id','work_order_no','material_no','cnc_machine_id','event_status','event_message']
  async function load(){ setDevices((await apiClient.get('/hardware-simulator/pda/devices')).data||[]); setScans((await apiClient.get('/architecture/scan/events')).data||[]) }
  async function scanDemo(){ await apiClient.post('/hardware-simulator/pda/scan-demo').catch(showError); await load() }
  useEffect(()=>{load()},[])
  return <div className="page"><PageHeader title="WiFi PDA / Android 手持端模擬器" subtitle="模擬掃描員工、工單、物料與 CNC QR Code。"><button className="primary-btn" onClick={scanDemo}>模擬 PDA 掃描</button><button onClick={load}>重新整理</button></PageHeader><div className="card"><h2>PDA 裝置</h2><DataTable columns={deviceColumns} rows={devices}/></div><div className="card"><h2>掃描事件</h2><DataTable columns={scanColumns} rows={scans}/></div></div>
}

export function NfcQrTagSimulator(){
  const [tags,setTags]=useState([]), [scans,setScans]=useState([])
  const tagColumns=['tag_id','tag_code','tag_type','bind_target_type','bind_target_code','bind_target_name','enabled_flag','last_scan_time']
  const scanColumns=['scan_event_id','scan_time','scan_type','scan_code','operator_id','work_order_no','material_no','cnc_machine_id','event_status','event_message']
  async function load(){ setTags((await apiClient.get('/hardware-simulator/tags')).data||[]); setScans((await apiClient.get('/architecture/scan/events')).data||[]) }
  async function scanDemo(){ await apiClient.post('/hardware-simulator/tags/scan-demo').catch(showError); await load() }
  useEffect(()=>{load()},[])
  return <div className="page"><PageHeader title="NFC 卡 / QR Code 標籤模擬器" subtitle="綁定員工、料件、工單、CNC 等現場標籤。"><button className="primary-btn" onClick={scanDemo}>模擬 NFC / QR 掃描</button><button onClick={load}>重新整理</button></PageHeader><div className="card"><h2>標籤綁定資料</h2><DataTable columns={tagColumns} rows={tags}/></div><div className="card"><h2>掃描事件</h2><DataTable columns={scanColumns} rows={scans}/></div></div>
}

export function CncMeterSimulator(){
  const [simMeters,setSimMeters]=useState([]),[links,setLinks]=useState([]),[rawRows,setRawRows]=useState([]),[features,setFeatures]=useState([])
  const simColumns=['sim_meter_id','cnc_machine_id','meter_id','device_ip','protocol_type','modbus_unit_id','power_kw','demand_kw','thd_current','machine_status','online_flag']
  const linkColumns=['cnc_machine_id','meter_id','device_ip','protocol_type','modbus_unit_id','connected_flag','machine_status','power_kw','demand_kw','thd_current','estimated_machine_status']
  const rawColumns=['meter_data_id','collect_time','cnc_machine_id','power_kw','demand_kw','thd_current','device_ip']
  const featureColumns=['feature_id','feature_time','cnc_machine_id','avg_power_kw_5min','thd_current_avg','estimated_machine_status','machine_abnormal_power_flag']
  async function load(){ setSimMeters((await apiClient.get('/hardware-simulator/cnc/meters')).data||[]); setLinks((await apiClient.get('/meter/electric/cnc-links')).data||[]); setRawRows((await apiClient.get('/meter/raw/latest')).data||[]); setFeatures((await apiClient.get('/meter/features/latest')).data||[]) }
  async function sendMeter(cnc){ await apiClient.post(`/meter/electric/demo/${cnc}`).catch(showError); await load() }
  async function seedAll(){ await apiClient.post('/meter/electric/demo-all').catch(showError); await load() }
  useEffect(()=>{load()},[])
  return <div className="page"><PageHeader title="CNC 機台 + 智慧電表模擬器" subtitle="智慧電表資料已改為 FFA 電表介面資料格式，並與 CNC、AIPS 特徵工程、DQN State 串聯。"><button className="primary-btn" onClick={()=>sendMeter('CNC-01')}>模擬 CNC-01</button><button className="primary-btn" onClick={()=>sendMeter('CNC-02')}>模擬 CNC-02</button><button className="primary-btn" onClick={()=>sendMeter('CNC-03')}>模擬 CNC-03</button><button onClick={seedAll}>模擬全部</button><button onClick={load}>重新整理</button></PageHeader><div className="card"><h2>智慧電表與 CNC 串聯架構</h2><div className="flow-grid">{['CNC 智慧電表|Modbus TCP / Ethernet 回傳功率、需量、THD、PF、kWh。','電表監控介面|採 FFA 智慧電表畫面：本月用電、碳排、每月用電曲線。','AIPS 特徵工程|轉成 avg_power、THD、狀態、異常旗標。','DQN State|與 ERP 製令、WMS 線邊庫一起形成 AI 排程輸入。'].map((s,i)=>{const[a,b]=s.split('|');return <div className="flow-step" key={a}><strong>{i+1}. {a}</strong><span>{b}</span></div>})}</div></div><div className="card"><h2>模擬智慧電表</h2><DataTable columns={simColumns} rows={simMeters}/></div><div className="card"><h2>CNC 與智慧電表連線</h2><DataTable columns={linkColumns} rows={links}/></div><div className="card"><h2>寫入後 CNC 電表資料</h2><DataTable columns={rawColumns} rows={rawRows}/></div><div className="card"><h2>AI 特徵資料</h2><DataTable columns={featureColumns} rows={features}/></div></div>
}

export function LineSideLogisticsSimulator(){
  const [rows,setRows]=useState([]),[inv,setInv]=useState([])
  const columns=['logistics_id','event_time','cart_code','operator_id','work_order_no','material_no','from_location','to_location','logistics_action','qty','event_status']
  const invColumns=['snapshot_id','snapshot_time','cnc_machine_id','material_no','current_qty','available_qty','shortage_flag','shortage_qty','replenishment_required_flag']
  async function load(){ setRows((await apiClient.get('/hardware-simulator/logistics')).data||[]); setInv((await apiClient.get('/inventory/snapshots/latest')).data||[]) }
  async function demo(){ await apiClient.post('/hardware-simulator/logistics/cart-demo').catch(showError); await load() }
  useEffect(()=>{load()},[])
  return <div className="page"><PageHeader title="線邊庫 / 人工物流模擬器" subtitle="模擬人工推車補料、領料、退料，並回寫 WMS 線邊庫庫存。"><button className="primary-btn" onClick={demo}>模擬補料事件</button><button onClick={load}>重新整理</button></PageHeader><div className="card"><h2>人工物流事件</h2><DataTable columns={columns} rows={rows}/></div><div className="card"><h2>線邊庫庫存快照</h2><DataTable columns={invColumns} rows={inv}/></div></div>
}


export function ErpSimulator(){
  const [summary,setSummary]=useState({})
  const [orders,setOrders]=useState([])
  const [callbacks,setCallbacks]=useState([])
  const [message,setMessage]=useState('')
  const orderColumns=['snapshot_id','snapshot_time','work_order_no','sales_order_no','product_no','planned_qty','completed_qty','remaining_qty','current_process_status','priority_level','assigned_cnc_machine_id']
  const callbackColumns=['integration_id','integration_time','direction','api_name','status','message']
  async function load(){
    setSummary((await apiClient.get('/erp-simulator/summary')).data||{})
    setOrders((await apiClient.get('/erp-simulator/orders/latest')).data||[])
    setCallbacks((await apiClient.get('/erp-simulator/callbacks/latest')).data||[])
  }
  async function receiveDemo(){
    const res=await apiClient.post('/erp-simulator/receive-demo').catch(showError)
    if(res?.data) setMessage(res.data.message || 'ERP 新製令已接收')
    await load()
  }
  async function processPending(){
    const res=await apiClient.post('/erp-simulator/process-pending').catch(showError)
    if(res?.data) setMessage(res.data.message || 'ERP 處理結果已回傳')
    await load()
  }
  async function runFullFlow(){
    const res=await apiClient.post('/aips/data-engineering/run-full-flow').catch(showError)
    if(res?.data) setMessage(res.data.message || '已執行 AIPS 1-10 全流程並回傳 ERP')
    await load()
  }
  useEffect(()=>{load()},[])
  return <div className="page"><PageHeader title="ERP 模擬器" subtitle="模擬 ERP 送入製令資料，AIPS 處理完成後再回傳 ERP 模擬器。"><button className="primary-btn" onClick={receiveDemo}>接收 ERP 新製令</button><button onClick={processPending}>處理完成並回傳 ERP</button><button onClick={runFullFlow}>跑 AIPS 1-10 + ERP 回傳</button><button onClick={load}>重新整理</button></PageHeader>{message&&<div className="export-message">操作結果：{message}</div>}<div className="metric-grid"><div className="metric-card"><div className="metric-label">ERP 總製令</div><div className="metric-value">{summary.total_count||0}</div><div className="metric-hint">ERP 模擬器目前最新製令數</div></div><div className="metric-card"><div className="metric-label">ERP 已處理</div><div className="metric-value">{summary.processed_count||0}</div><div className="metric-hint">AIPS 已回傳 ERP 的製令</div></div><div className="metric-card"><div className="metric-label">ERP 未處理</div><div className="metric-value">{summary.unprocessed_count||0}</div><div className="metric-hint">已接收但尚未處理完成</div></div></div><div className="card"><h2>ERP 模擬流程</h2><div className="flow-grid">{['ERP送入製令|寫入 work_order_progress_snapshot，狀態 RECEIVED。','AIPS資料工程|Step1 接收 ERP，Step2 建立 ERP 特徵。','DQN排程|ERP 製令進入 State / Action / Reward。','回傳ERP|處理完成後新增 PROCESSED snapshot 並寫入 OUTBOUND callback。'].map((s,i)=>{const[a,b]=s.split('|');return <div className="flow-step" key={a}><strong>{i+1}. {a}</strong><span>{b}</span></div>})}</div></div><div className="card"><h2>ERP 製令資料</h2><DataTable columns={orderColumns} rows={orders}/></div><div className="card"><h2>AIPS 回傳 ERP 紀錄</h2><DataTable columns={callbackColumns} rows={callbacks}/></div></div>
}
