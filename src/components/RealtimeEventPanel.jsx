import React, { useEffect, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'
import { PageHeader, showError } from './SimplePanels.jsx'

export default function RealtimeEventPanel(){
  const [events,setEvents]=useState([]),[pushes,setPushes]=useState([]),[message,setMessage]=useState('')
  const eventColumns=['event_id','event_time','event_source','event_type','event_level','topic','process_status']
  const pushColumns=['push_id','push_time','channel_name','target_user','message_title','message_body','push_status']
  async function load(){ const ts=Date.now(); setEvents((await apiClient.get(`/architecture/events/realtime?_=${ts}`)).data||[]); setPushes((await apiClient.get(`/architecture/events/websocket-push?_=${ts}`)).data||[]) }
  async function createEvent(){ const res=await apiClient.post('/architecture/events/realtime/demo').catch(showError); setMessage(`已新增 MQTT 事件：${res?.data?.event_id||''}`); await load() }
  async function createPush(){ const res=await apiClient.post('/architecture/events/websocket-push/demo').catch(showError); setMessage(`已新增 WebSocket 推播：${res?.data?.push_id||''}`); await load() }
  useEffect(()=>{load()},[])
  return <div className="page"><PageHeader title="即時事件" subtitle="MQTT / Gateway 事件與 WebSocket 即時推播紀錄。"><button className="primary-btn" onClick={createEvent}>新增 MQTT 事件 Demo</button><button onClick={createPush}>新增 WebSocket 推播 Demo</button><button onClick={load}>重新整理</button></PageHeader>{message&&<div className="export-message">{message}</div>}<div className="card"><h2>MQTT / Gateway 即時事件</h2><DataTable columns={eventColumns} rows={events}/></div><div className="card"><h2>WebSocket 即時推播紀錄</h2><DataTable columns={pushColumns} rows={pushes}/></div></div>
}
