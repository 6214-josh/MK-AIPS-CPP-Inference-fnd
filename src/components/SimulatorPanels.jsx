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
