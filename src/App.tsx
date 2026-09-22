import { useEffect, useRef, useState, useMemo } from 'react'
import { DEFAULTS, DEFAULT_OPEN_WHEN, DEFAULT_QUESTIONS, DEFAULT_MESSAGE, type OpenWhenLetter } from './config'
import { supabase, isSupabase } from './supabase'

type UserId = 'Tanaka' | 'Diane'
type Note = { id:string, text:string, author:UserId, date:string }
type Memory = { id:string, date:string, caption:string, text:string, image:string, author:UserId }
type DailyAnswer = { question:string, tanaka?:string, diane?:string, date:string }
type HeartEvent = { id:string, from:UserId }
type ThinkingEvent = { from:UserId, at:number }

// storage helpers
const LS = {
  get<T>(k:string, fallback:T):T { try{ const v=localStorage.getItem(k); return v? JSON.parse(v) : fallback } catch{ return fallback } },
  set(k:string, v:unknown){ localStorage.setItem(k, JSON.stringify(v)) }
}

function useCountdown(targetISO:string){
  const [now,setNow]=useState(()=>Date.now())
  useEffect(()=>{
    const id=setInterval(()=>setNow(Date.now()),1000)
    return ()=>clearInterval(id)
  },[])
  const target = useMemo(()=> new Date(targetISO).getTime(), [targetISO])
  const diff = target - now
  const abs = Math.max(0, diff)
  const days = Math.floor(abs/86400000)
  const hours = Math.floor((abs%86400000)/3600000)
  const minutes = Math.floor((abs%3600000)/60000)
  const seconds = Math.floor((abs%60000)/1000)
  return { diff, days, hours, minutes, seconds, target }
}

export default function App(){
  // gate — personal, PIN 210508, then Tanaka 0000 / Diane 1111
  const [gateAuth,setGateAuth]=useState(()=> LS.get<boolean>('td_gate_auth', false))
  const [gateWho,setGateWho]=useState<UserId | null>(()=> LS.get<UserId | null>('td_gate_who', null))
  const [gateStep,setGateStep]=useState<0|1|2>(0)
  const [gatePin,setGatePin]=useState('')
  const [gateErr,setGateErr]=useState<string|null>(null)
  const [gateUserPin,setGateUserPin]=useState('')
  const [gateUserErr,setGateUserErr]=useState<string|null>(null)
  const [gateChoice,setGateChoice]=useState<UserId | null>(null)
  // identity — who is Tanaka or Diane
  const [who,setWho]=useState<UserId>(()=> LS.get<UserId>('td_who','Diane'))
  useEffect(()=> LS.set('td_who', who), [who])

  function submitGate(){
    if(gatePin==='210508'){ setGateStep(2); setGateErr(null)}
    else { setGateErr('Wrong pin — try again. Hint: our day?'); setGatePin('')}
  }
  function submitWho(){
    if(!gateChoice) { setGateUserErr('Pick who you are first'); return }
    const need = gateChoice==='Diane' ? '1111' : '0000'
    if(gateUserPin===need){
      setWho(gateChoice); LS.set('td_who', gateChoice)
      setGateWho(gateChoice); LS.set('td_gate_who', gateChoice)
      setGateAuth(true); LS.set('td_gate_auth', true)
      setGateUserErr(null)
    } else {
      setGateUserErr(`Wrong pin for ${gateChoice} — try again`)
      setGateUserPin('')
    }
  }
  // if already authed but who mismatched gateWho, sync
  useEffect(()=>{ if(gateAuth && gateWho && gateWho!==who) setWho(gateWho) },[gateAuth, gateWho, who])
  // force new 2-step gate for users who authed with old single-step (no gateWho yet)
  useEffect(()=>{
    const hasOldAuth = LS.get<boolean>('td_gate_auth', false)
    const hasWho = LS.get<UserId | null>('td_gate_who', null)
    if(hasOldAuth && !hasWho){
      LS.set('td_gate_auth', false)
      setGateAuth(false)
      setGateStep(0)
    }
  },[])

  // config state
  const [meetingISO,setMeetingISO]=useState(()=>{
    const stored = LS.get<string>('td_meeting', DEFAULTS.meetingDate)
    // migrate old 24th to new 4th December date
    if(stored.includes('2026-12-24')) return DEFAULTS.meetingDate
    return stored
  })
  const [metISO,setMetISO]=useState(()=> LS.get<string>('td_met', DEFAULTS.metDate))
  const [hideMet,setHideMet]=useState(()=> LS.get<boolean>('td_hide_met', true))
  const [message,setMessage]=useState(()=>{
    const stored = LS.get<string>('td_message', DEFAULT_MESSAGE)
    // migrate old heartfelt letter to new ego line if user still has the old one stored
    if(stored.includes('I built this little corner') || stored.includes('Yours completely')) return DEFAULT_MESSAGE
    return stored
  })
  const [openWhen,setOpenWhen]=useState<OpenWhenLetter[]>(()=> LS.get<OpenWhenLetter[]>('td_open', DEFAULT_OPEN_WHEN))
  const [questions]=useState<string[]>(DEFAULT_QUESTIONS) // workshop could add
  const [photo,setPhoto]=useState(()=>{
    const stored = LS.get<string>('td_photo','')
    if(!stored || stored.includes('unsplash') || stored.includes('diane-greatwall')) return '/photos/us-collage.png'
    return stored
  })
  const [songUrl,setSongUrl]=useState(()=>{
    const v=LS.get<string>('td_song', DEFAULTS.songUrl)
    // migrate old demo song to your real song
    if(v.includes('pixabay')) return DEFAULTS.songUrl
    return v
  })
  const [songName,setSongName]=useState(()=>{
    const v=LS.get<string>('td_song_name', (DEFAULTS as unknown as {songName:string}).songName || 'Secondhand - Don Toliver ft Rema')
    if(v==='Our song' || v.includes('feat. Rema') || v.includes('(8D AUDIO)') || v==='Secondhand — Don Toliver') return (DEFAULTS as unknown as {songName:string}).songName
    return v
  })
  // music + video morph — needs to be before supa sync
  const [playing,setPlaying]=useState(false)
  const [videoUrl,setVideoUrl]=useState(()=>{
    const stored = LS.get<string>('td_video_url', '')
    if(!stored || stored.trim()==='') return (DEFAULTS as unknown as {videoUrl:string}).videoUrl || ''
    return stored
  })
  const [videoName,setVideoName]=useState(()=>{
    const stored = LS.get<string>('td_video_name', '')
    if(!stored || stored.trim()==='' || stored.includes('(8D AUDIO)') || stored.includes('feat. Rema')) return (DEFAULTS as unknown as {videoName:string}).videoName
    return stored
  })
  const [videoOpen,setVideoOpen]=useState(false)
  const audioRef=useRef<HTMLAudioElement>(null)
  const videoRef=useRef<HTMLVideoElement>(null)
  useEffect(()=>{
    const v=LS.get<boolean>('td_playing', false)
    setPlaying(v)
  },[])
  // migrate empty stored video to default once
  useEffect(()=>{
    if(!videoUrl && (DEFAULTS as unknown as {videoUrl:string}).videoUrl){
      setVideoUrl((DEFAULTS as unknown as {videoUrl:string}).videoUrl)
    }
    if(!videoName && (DEFAULTS as unknown as {videoName:string}).videoName){
      setVideoName((DEFAULTS as unknown as {videoName:string}).videoName)
    }
  },[]) // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=> LS.set('td_video_url', videoUrl),[videoUrl])
  useEffect(()=> LS.set('td_video_name', videoName),[videoName])
  useEffect(()=>{
    LS.set('td_playing', playing);
    if(videoUrl){
      if(videoOpen && videoRef.current){ if(playing) videoRef.current.play().catch(()=>{}) ; else videoRef.current.pause(); try{ audioRef.current?.pause()}catch{} }
      else if(!videoOpen && audioRef.current){ if(playing) audioRef.current.play().catch(()=>{}) ; else audioRef.current.pause() }
      return
    }
    if(audioRef.current){ if(playing) audioRef.current.play().catch(()=>{}) ; else audioRef.current.pause()}
  },[playing, videoUrl, videoOpen])

  useEffect(()=> LS.set('td_meeting', meetingISO),[meetingISO])
  useEffect(()=> LS.set('td_met', metISO),[metISO])
  useEffect(()=> LS.set('td_hide_met', hideMet),[hideMet])
  useEffect(()=> LS.set('td_message', message),[message])
  useEffect(()=> LS.set('td_open', openWhen),[openWhen])
  // sync app_config to Supabase (debounced)
  const supaSyncRef = useRef<number | null>(null)
  useEffect(()=>{
    if(!isSupabase || !supabase) return
    if(supaSyncRef.current) window.clearTimeout(supaSyncRef.current)
    supaSyncRef.current = window.setTimeout(()=>{
      supabase!.from('app_config').upsert({
        id:1,
        meeting_date: meetingISO,
        message, photo, song_url: songUrl, song_name: songName,
        video_url: videoUrl, video_name: videoName,
        hide_met: hideMet,
        updated_at: new Date().toISOString()
      }, { onConflict:'id'}).then(()=>{})
    }, 800)
    return ()=>{ if(supaSyncRef.current) window.clearTimeout(supaSyncRef.current)}
  },[meetingISO, message, photo, songUrl, songName, videoUrl, videoName, hideMet])
  useEffect(()=> LS.set('td_photo', photo),[photo])
  useEffect(()=> LS.set('td_song', songUrl),[songUrl])
  useEffect(()=> LS.set('td_song_name', songName),[songName])

  const countdown = useCountdown(meetingISO)
  const isToday = countdown.diff <= 0

  // notes — no presaved notes, start empty as requested
  const [notes,setNotes]=useState<Note[]>(()=>{
    const stored = LS.get<Note[]>('td_notes', [] as Note[])
    // migrate: clear old presaved demo notes if they match the exact demo texts
    const demo = new Set([
      "I was thinking about you today. Again. Obviously.",
      "You randomly crossed my mind and now I can't focus 😂",
      "I hope you know how special you are to me, Diane.",
    ])
    if(stored.length>0 && stored.every(n=> demo.has(n.text))) return []
    return stored
  })
  useEffect(()=> LS.set('td_notes', notes),[notes])
  const [noteDraft,setNoteDraft]=useState('')

  // memories — cleared presaved, start empty
  const [memories,setMemories]=useState<Memory[]>(()=>{
    const stored = LS.get<Memory[]>('td_memories', [] as Memory[])
    const demoIds = new Set(['m1','m2','m3'])
    if(stored.length>0 && stored.every(m=> demoIds.has(m.id) && m.caption.includes('❤️'))) return []
    // also clear if it's exactly the old DEFAULT_MEMORIES
    if(stored.length===3 && stored[0]?.id==='m1') return []
    return stored
  })
  useEffect(()=> LS.set('td_memories', memories),[memories])
  const [memDraft,setMemDraft]=useState<{caption:string,text:string,image:string}>({caption:'',text:'',image:''})

  // daily question
  const todayStr = new Date().toISOString().slice(0,10)
  const dailyIdx = useMemo(()=> {
    const d=new Date(); return (d.getDate()+ d.getMonth()*3)% questions.length
  },[questions.length])
  const todayQ = questions[dailyIdx]
  const [daily,setDaily]=useState<DailyAnswer>(()=> LS.get<DailyAnswer>('td_daily_'+todayStr, { question: questions[(new Date().getDate()+ new Date().getMonth()*3)%questions.length], date: todayStr}))
  useEffect(()=>{ if(daily.question!==todayQ) setDaily({question:todayQ,date:todayStr}) },[todayQ, todayStr, daily.question])
  useEffect(()=> LS.set('td_daily_'+todayStr, daily),[daily, todayStr])
  const [answerDraft,setAnswerDraft]=useState('')

  // hearts / thinking realtime via BroadcastChannel + storage event
  const [hearts,setHearts]=useState<HeartEvent[]>([])
  const [thinking,setThinking]=useState<ThinkingEvent|null>(null)
  const [toast,setToast]=useState<string|null>(null)
  const bcRef = useRef<BroadcastChannel|null>(null)
  useEffect(()=>{
    try{ bcRef.current = new BroadcastChannel('tanaka-diane')}catch{}
    const bc=bcRef.current
    const onMsg=(e:MessageEvent)=>{
      const d=e.data
      if(d.type==='heart'){ triggerHearts(d.from as UserId,false); setToast(`From ${d.from} ❤️`); setTimeout(()=>setToast(null),2800)}
      if(d.type==='thinking'){ setThinking({from:d.from,at:Date.now()}); setToast(`${d.from} is thinking about you ❤️`); setTimeout(()=>{setThinking(null); setToast(null)},3500)}
      if(d.type==='board'){ /* handled elsewhere */ }
      if(d.type==='note'){ setNotes(prev=>[d.note, ...prev])}
    }
    if(bc) bc.onmessage=onMsg
    const onStorage=(e:StorageEvent)=>{
      if(e.key==='td_heart_evt' && e.newValue){ const v=JSON.parse(e.newValue); triggerHearts(v.from,false); setToast(`From ${v.from} ❤️`); setTimeout(()=>setToast(null),2800)}
      if(e.key==='td_think_evt' && e.newValue){ const v=JSON.parse(e.newValue); setThinking({from:v.from,at:Date.now()}); setToast(`${v.from} is thinking about you ❤️`); setTimeout(()=>{setThinking(null); setToast(null)},3500)}
    }
    window.addEventListener('storage', onStorage)
    return ()=>{ bc?.close(); window.removeEventListener('storage',onStorage)}
  },[])

  // Supabase realtime — cross-device sync
  const supaChanRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  useEffect(()=>{
    if(!isSupabase || !supabase) return
    // initial fetch from Supabase (hydrate)
    ;(async()=>{
      try{
        const { data: cfg } = await supabase!.from('app_config').select('*').eq('id',1).single()
        if(cfg){
          if(cfg.meeting_date) setMeetingISO(new Date(cfg.meeting_date).toISOString())
          if(cfg.message) setMessage(cfg.message)
          if(cfg.photo) setPhoto(cfg.photo)
          if(cfg.song_url) setSongUrl(cfg.song_url)
          if(cfg.song_name) setSongName(cfg.song_name)
          if(cfg.video_url) setVideoUrl(cfg.video_url)
          if(cfg.video_name) setVideoName(cfg.video_name)
          if(typeof cfg.hide_met==='boolean') setHideMet(cfg.hide_met)
        }
        const { data: n } = await supabase!.from('notes').select('*').order('created_at',{ascending:false}).limit(50)
        if(n && n.length){
          const mapped: Note[] = n.map((r:any)=> ({ id:r.id, text:r.text, author:r.author as UserId, date: new Date(r.created_at).toISOString().slice(0,10) }))
          setNotes(mapped)
        }
        const { data: m } = await supabase!.from('memories').select('*').order('created_at',{ascending:false}).limit(30)
        if(m && m.length){
          const mappedM: Memory[] = m.map((r:any)=> ({ id:r.id, caption:r.caption, text:r.text||'', image:r.image, author:r.author as UserId, date:r.date }))
          setMemories(mappedM)
        }
        const { data: bb } = await supabase!.from('blackboard').select('data').eq('id',1).single()
        if(bb?.data){
          localStorage.setItem('td_board', bb.data)
          // canvas will load from localStorage on next paint; trigger reload if canvas already mounted
          const c=canvasRef.current; if(c){
            const ctx=c.getContext('2d'); const rect=c.getBoundingClientRect(); const img=new Image()
            img.onload=()=>{ if(ctx){ ctx.clearRect(0,0,rect.width,380); ctx.fillStyle='#0d1a14'; ctx.fillRect(0,0,rect.width,380); ctx.drawImage(img,0,0,rect.width,380)}}
            img.src=bb.data
          }
        }
        const { data: da } = await supabase!.from('daily_answers').select('*').eq('date', todayStr).single()
        if(da){
          setDaily({ question: da.question || todayQ, tanaka: da.tanaka || undefined, diane: da.diane || undefined, date: da.date })
        }
      }catch(e){ console.warn('Supabase hydrate failed', e)}
    })()
    // postgres realtime
    const dbChan = supabase!.channel('td-db')
      .on('postgres_changes',{event:'INSERT', schema:'public', table:'notes'}, (payload:any)=>{
        const r=payload.new
        const note: Note={ id:r.id, text:r.text, author:r.author as UserId, date: new Date(r.created_at).toISOString().slice(0,10)}
        setNotes(prev=> prev.some(p=>p.id===note.id)? prev : [note, ...prev])
      })
      .on('postgres_changes',{event:'INSERT', schema:'public', table:'memories'}, (payload:any)=>{
        const r=payload.new
        const mem: Memory={ id:r.id, caption:r.caption, text:r.text||'', image:r.image, author:r.author as UserId, date:r.date }
        setMemories(prev=> prev.some(p=>p.id===mem.id)? prev : [mem, ...prev])
      })
      .on('postgres_changes',{event:'*', schema:'public', table:'daily_answers'}, (payload:any)=>{
        const r=payload.new
        if(r?.date===todayStr){
          setDaily({ question: r.question || todayQ, tanaka: r.tanaka||undefined, diane: r.diane||undefined, date: r.date })
        }
      })
      .on('postgres_changes',{event:'UPDATE', schema:'public', table:'blackboard'}, (payload:any)=>{
        const r=payload.new
        if(r?.data){
          localStorage.setItem('td_board', r.data)
          const c=canvasRef.current; if(c){
            const ctx=c.getContext('2d'); const rect=c.getBoundingClientRect(); const img=new Image()
            img.onload=()=>{ if(ctx){ ctx.clearRect(0,0,rect.width,380); ctx.fillStyle='#0d1a14'; ctx.fillRect(0,0,rect.width,380); ctx.drawImage(img,0,0,rect.width,380)}}
            img.src=r.data
          }
        }
      })
      .on('postgres_changes',{event:'UPDATE', schema:'public', table:'app_config'}, (payload:any)=>{
        const r=payload.new
        if(r?.meeting_date) setMeetingISO(new Date(r.meeting_date).toISOString())
        if(r?.message) setMessage(r.message)
        if(r?.photo) setPhoto(r.photo)
        if(r?.song_url) setSongUrl(r.song_url)
        if(r?.song_name) setSongName(r.song_name)
        if(r?.video_url) setVideoUrl(r.video_url)
        if(r?.video_name) setVideoName(r.video_name)
        if(typeof r?.hide_met==='boolean') setHideMet(r.hide_met)
      })
      .subscribe()

    // broadcast for ephemeral events (hearts, thinking, board strokes)
    const bc = supabase!.channel('td-room', { config: { broadcast: { self: false } } })
      .on('broadcast', {event:'heart'}, (payload:any)=>{
        const from = payload.payload?.from as UserId
        if(from){ triggerHearts(from,false); setToast(`From ${from} ❤️`); setTimeout(()=>setToast(null),2800)}
      })
      .on('broadcast', {event:'thinking'}, (payload:any)=>{
        const from = payload.payload?.from as UserId
        if(from){ setThinking({from, at:Date.now()}); setToast(`${from} is thinking about you ❤️`); setTimeout(()=>{setThinking(null); setToast(null)},3500)}
      })
      .on('broadcast', {event:'board'}, (payload:any)=>{
        const img = payload.payload?.img
        if(img){
          localStorage.setItem('td_board', img)
          const c=canvasRef.current; if(c){
            const ctx=c.getContext('2d'); const rect=c.getBoundingClientRect(); const im=new Image()
            im.onload=()=>{ if(ctx){ ctx.clearRect(0,0,rect.width,380); ctx.fillStyle='#0d1a14'; ctx.fillRect(0,0,rect.width,380); ctx.drawImage(im,0,0,rect.width,380)}}
            im.src=img
          }
        }
      })
      .on('broadcast', {event:'board-status'}, (payload:any)=>{
        const who2=payload.payload?.who; const tool2=payload.payload?.tool
        if(who2){ setBoardStatus(`${who2} is ${tool2==='eraser'?'erasing':'drawing'}...`); setTimeout(()=> setBoardStatus('Our board ❤️'),1600)}
      })
      .subscribe()
    supaChanRef.current = bc
    return ()=>{ supabase!.removeChannel(dbChan); supabase!.removeChannel(bc) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[todayStr, todayQ])

  function broadcast(type:string, payload:unknown){
    try{ bcRef.current?.postMessage({type, ...payload as object})}catch{}
    // also Supabase broadcast for cross-device
    if(isSupabase && supaChanRef.current){
      const p = payload as Record<string, unknown>
      supaChanRef.current.send({ type:'broadcast', event: type, payload: p })
    }
  }
  function triggerHearts(from:UserId, doBroadcast=true){
    const id=Math.random().toString(36).slice(2)
    setHearts(h=>[...h,{id,from}])
    setTimeout(()=> setHearts(h=>h.filter(x=>x.id!==id)), 1600)
    if(doBroadcast){
      broadcast('heart',{from})
      localStorage.setItem('td_heart_evt', JSON.stringify({from, at:Date.now()}))
      // also persist nothing, hearts are ephemeral
    }
  }
  function sendThinking(){
    setThinking({from:who, at:Date.now()})
    broadcast('thinking',{from:who})
    localStorage.setItem('td_think_evt', JSON.stringify({from:who, at:Date.now()}))
    setToast(`You let ${who==='Tanaka'?'Diane':'Tanaka'} know you're thinking of them ❤️`)
    setTimeout(()=> setToast(null),2600)
    setTimeout(()=> setThinking(null),3500)
  }
  function sendLove(){ triggerHearts(who,true); setToast(`You sent a little love to ${who==='Tanaka'?'Diane':'Tanaka'} ❤️`); setTimeout(()=>setToast(null),2200) }

  // blackboard canvas
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const [tool,setTool]=useState<'chalk'|'eraser'>('chalk')
  const [color,setColor]=useState('#ffffff')
  const [isDrawing,setIsDrawing]=useState(false)
  const [boardStatus,setBoardStatus]=useState<string>('Our board ❤️')
  const [history,setHistory]=useState<string[]>([])
  const [redoStack,setRedoStack]=useState<string[]>([])
  const drawingRef=useRef(false)

  // load/save board
  useEffect(()=>{
    const c=canvasRef.current; if(!c) return
    const ctx=c.getContext('2d'); if(!ctx) return
    const dpr=window.devicePixelRatio||1
    const rect=c.getBoundingClientRect()
    c.width=rect.width*dpr; c.height=380*dpr
    ctx.scale(dpr,dpr)
    // bg
    ctx.fillStyle='#0d1a14'; ctx.fillRect(0,0,rect.width,380)
    const saved=localStorage.getItem('td_board')
    if(saved){
      const img=new Image(); img.onload=()=>{ ctx.drawImage(img,0,0,rect.width,380); saveHistoryInner()}
      img.src=saved
    } else {
      // welcome doodle hint
      ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.setLineDash([6,6]); ctx.strokeRect(20,20,rect.width-40,340); ctx.setLineDash([])
      ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='16px Caveat'; ctx.fillText('Write something for Diane here...',28,42)
      saveHistoryInner()
    }
    function saveHistoryInner(){
      try{ const url=c!.toDataURL(); setHistory(h=>[...h.slice(-12), url])}catch{}
    }
    // resize observer
    const ro=new ResizeObserver(()=>{
      // preserve content: snapshot then redraw
      const snap=c.toDataURL()
      const r=c.getBoundingClientRect()
      c.width=r.width*dpr; c.height=380*dpr
      const x=c.getContext('2d')!; x.scale(dpr,dpr)
      x.fillStyle='#0d1a14'; x.fillRect(0,0,r.width,380)
      const im=new Image(); im.onload=()=> x.drawImage(im,0,0,r.width,380)
      im.src=snap
    })
    ro.observe(c)
    return ()=> ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  function saveBoard(){
    const c=canvasRef.current; if(!c) return
    let data=""
    try{ data=c.toDataURL(); localStorage.setItem('td_board', data)}catch{}
    if(isSupabase && supabase && data){
      supabase!.from('blackboard').upsert({ id:1, data, updated_by: who, updated_at: new Date().toISOString() }).then(()=>{})
    }
  }
  function pushHistory(){
    const c=canvasRef.current; if(!c) return
    setHistory(h=>[...h.slice(-20), c.toDataURL()])
    setRedoStack([])
  }
  function undo(){
    if(history.length<2) return
    const c=canvasRef.current; if(!c) return
    const prev=history[history.length-2]
    setRedoStack(r=>[...r, history[history.length-1]])
    setHistory(h=>h.slice(0,-1))
    const ctx=c.getContext('2d')!; const img=new Image()
    img.onload=()=>{
      const rect=c.getBoundingClientRect()
      ctx.clearRect(0,0,rect.width,380)
      ctx.fillStyle='#0d1a14'; ctx.fillRect(0,0,rect.width,380)
      ctx.drawImage(img,0,0,rect.width,380)
      saveBoard()
    }
    img.src=prev
  }
  function redo(){
    if(redoStack.length===0) return
    const c=canvasRef.current; if(!c) return
    const nxt=redoStack[redoStack.length-1]
    setRedoStack(r=>r.slice(0,-1))
    setHistory(h=>[...h,nxt])
    const ctx=c.getContext('2d')!; const img=new Image()
    img.onload=()=>{
      const rect=c.getBoundingClientRect()
      ctx.clearRect(0,0,rect.width,380)
      ctx.fillStyle='#0d1a14'; ctx.fillRect(0,0,rect.width,380)
      ctx.drawImage(img,0,0,rect.width,380)
      saveBoard()
    }
    img.src=nxt
  }
  function clearBoard(){
    const c=canvasRef.current; if(!c) return
    const ctx=c.getContext('2d')!; const rect=c.getBoundingClientRect()
    ctx.clearRect(0,0,rect.width,380)
    ctx.fillStyle='#0d1a14'; ctx.fillRect(0,0,rect.width,380)
    pushHistory(); saveBoard()
  }
  function getPos(e: React.MouseEvent|React.TouchEvent){
    const c=canvasRef.current!; const rect=c.getBoundingClientRect()
    const t = 'touches' in e ? e.touches[0] : (e as React.MouseEvent)
    return { x: t.clientX - rect.left, y: t.clientY - rect.top }
  }
  function startDraw(e:React.MouseEvent|React.TouchEvent){
    e.preventDefault()
    drawingRef.current=true; setIsDrawing(true)
    setBoardStatus(`${who} is ${tool==='eraser'?'erasing':'drawing'}...`)
    const c=canvasRef.current!; const ctx=c.getContext('2d')!
    const {x,y}=getPos(e)
    ctx.beginPath(); ctx.moveTo(x,y)
    ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth= tool==='eraser'? 22 : 2.8
    ctx.strokeStyle= tool==='eraser'? '#0d1a14' : color
    // chalk texture shadow
    if(tool==='chalk'){ ctx.shadowColor=color; ctx.shadowBlur=0.6 } else ctx.shadowBlur=0
    broadcast('board-status',{who, tool})
  }
  function moveDraw(e:React.MouseEvent|React.TouchEvent){
    if(!drawingRef.current) return
    e.preventDefault()
    const c=canvasRef.current!; const ctx=c.getContext('2d')!
    const {x,y}=getPos(e)
    ctx.lineTo(x,y); ctx.stroke()
  }
  function endDraw(){
    if(!drawingRef.current) return
    drawingRef.current=false; setIsDrawing(false)
    const c=canvasRef.current!; const ctx=c.getContext('2d')!
    ctx.closePath(); ctx.shadowBlur=0
    pushHistory(); saveBoard()
    setBoardStatus('Our board ❤️')
    setTimeout(()=> setBoardStatus('Our board ❤️'), 900)
    // sync lightweight: broadcast image every stroke (throttled)
    try{ broadcast('board',{img:c.toDataURL()})}catch{}
  }
  // listen board sync
  useEffect(()=>{
    const handler=(e:MessageEvent)=>{
      if(e.data?.type==='board' && e.data.img){
        const c=canvasRef.current; if(!c) return
        const ctx=c.getContext('2d')!; const rect=c.getBoundingClientRect()
        const img=new Image(); img.onload=()=>{
          ctx.clearRect(0,0,rect.width,380)
          ctx.fillStyle='#0d1a14'; ctx.fillRect(0,0,rect.width,380)
          ctx.drawImage(img,0,0,rect.width,380)
          localStorage.setItem('td_board', e.data.img)
        }
        img.src=e.data.img
      }
      if(e.data?.type==='board-status'){
        setBoardStatus(`${e.data.who} is ${e.data.tool==='eraser'?'erasing':'drawing'}...`)
        setTimeout(()=> setBoardStatus('Our board ❤️'), 1600)
      }
    }
    bcRef.current?.addEventListener('message', handler as EventListener)
    return ()=> bcRef.current?.removeEventListener('message', handler as EventListener)
  },[])

  // time together progress — note: daysSince hidden when hideMet is true
  const metTime = new Date(metISO).getTime()
  const meetTime = new Date(meetingISO).getTime()
  const nowTime = Date.now()
  const totalSpan = Math.max(1, meetTime - metTime)
  const elapsed = Math.min(totalSpan, Math.max(0, nowTime - metTime))
  const progressPct = Math.round((elapsed/totalSpan)*100)
  // kept for workshop when unhidden
  const daysSince = Math.floor((nowTime - metTime)/86400000) // eslint-disable-line @typescript-eslint/no-unused-vars
  void daysSince
  const daysUntil = Math.max(0, Math.ceil((meetTime - nowTime)/86400000))

  // milestone message
  const milestone = useMemo(()=>{
    const d=countdown.days
    if(isToday) return "Today. We're here. ❤️"
    if(d===0 && countdown.hours<=1) return "One more hour."
    if(d===0) return "Tomorrow."
    if(d<=3) return "It's getting real now…"
    if(d===7) return "ONE WEEK."
    if(d===14) return "Two weeks, Diane. TWO WEEKS 😭❤️"
    if(d===30) return "30 days until I see you again ❤️"
    if(d<7) return `${d} days left — almost there`
    return null
  },[countdown.days, countdown.hours, isToday])

  function handlePlayToggle(){
    // play/pause always just toggles audio/video playback — never opens video
    setPlaying(p=>!p)
  }
  function handleSeeVideo(){
    if(!videoUrl) return
    setVideoOpen(true)
    setPlaying(true)
    setTimeout(()=> videoRef.current?.play().catch(()=>{}), 220)
  }
  function closeVideoMorph(){
    setVideoOpen(false)
  }

  // secrets
  const [heartTaps,setHeartTaps]=useState(0)
  const [secret,setSecret]=useState<string|null>(null)
  function tapHeart(){
    const n=heartTaps+1; setHeartTaps(n)
    if(n===5){ setSecret("Okay okay, you found the secret 😂❤️ — Tanaka loves you more than he admits."); setTimeout(()=> setSecret(null), 4000); setHeartTaps(0)}
    else if(n>=3){ triggerHearts(who,true) }
  }

  // workshop auth (simple pin)
  const [showWorkshop,setShowWorkshop]=useState(false)
  const [pin,setPin]=useState('')
  const [pinOk,setPinOk]=useState(()=> LS.get<boolean>('td_pin_ok', false))
  const correctPin = LS.get<string>('td_workshop_pin','1108') // default
  function tryPin(){
    if(pin===correctPin){ setPinOk(true); LS.set('td_pin_ok',true); setShowWorkshop(true)}
    else { setToast('That pin is not right, love. Hint: our day?'); setTimeout(()=>setToast(null),2600)}
  }

  // open when removed — keep workshop editing but hide UI
  const [_opened,_setOpened]=useState<string|null>(null)
  void _opened; void _setOpened

  // add note — also persist to Supabase
  function addNote(){
    if(!noteDraft.trim()) return
    const n:Note={id: Math.random().toString(36).slice(2), text: noteDraft.trim(), author:who, date: new Date().toISOString().slice(0,10)}
    setNotes(prev=>[n,...prev])
    broadcast('note',{note:n})
    if(isSupabase && supabase){ supabase!.from('notes').insert({ text:n.text, author:n.author }).then(()=>{}) }
    setNoteDraft('')
    setToast('Little note left ❤️'); setTimeout(()=>setToast(null),2000)
  }
  // add memory — also to Supabase
  function addMemory(){
    if(!memDraft.caption.trim() || !memDraft.image.trim()) return
    const m:Memory={id:Math.random().toString(36).slice(2), caption:memDraft.caption, text:memDraft.text, image:memDraft.image, date: new Date().toISOString().slice(0,10), author:who}
    setMemories(prev=>[m,...prev])
    if(isSupabase && supabase){ supabase!.from('memories').insert({ caption:m.caption, text:m.text, image:m.image, author:m.author, date:m.date }).then(()=>{}) }
    setMemDraft({caption:'',text:'',image:''})
  }

  // letter expand
  const [letterOpen,setLetterOpen]=useState(false)

  // stories — instagram edge floating — real Tanaka & Diane photos (all 10)
  type Story = { id:string, image:string, label:string, caption:string, date:string, author:UserId }
  const stories: Story[] = useMemo(()=>[
    { id:'s-us', image: photo, label:'Us ❤️', caption:'Us — our favourite', date: new Date().toISOString().slice(0,10), author: who },
    ...memories.slice(0,2).map(m=> ({ id:m.id, image:m.image, label: m.caption.slice(0,12), caption: m.caption, date:m.date, author:m.author })),
    { id:'s-diane-greatwall', image: '/photos/diane-greatwall.png', label:'Diane', caption:'Diane at the Great Wall 😍', date: '2025-09-18', author:'Diane' as UserId },
    { id:'s-diane-marvins', image: '/photos/diane-marvins.png', label:'Diane', caption:'Diane — Marvins Room mood', date: '2025-09-16', author:'Diane' as UserId },
    { id:'s-diane-e85', image: '/photos/diane-e85.png', label:'Diane', caption:'E85 — Don Toliver 🥺✨', date: '2025-09-14', author:'Diane' as UserId },
    { id:'s-diane-party', image: '/photos/diane-partynextdoor.png', label:'Diane', caption:'Diane — PARTYNEXTDOOR mood ✨', date: '2025-09-12', author:'Diane' as UserId },
    { id:'s-tanaka-uniform', image: '/photos/tanaka-uniform.png', label:'Tanaka', caption:'Tanaka', date: '2025-09-10', author:'Tanaka' as UserId },
    { id:'s-tanaka-provincial', image: '/photos/tanaka-provincial.png', label:'Tanaka', caption:'Provincial winners 🏆', date: '2025-09-09', author:'Tanaka' as UserId },
    { id:'s-tanaka-mirror', image: '/photos/tanaka-mirror.png', label:'Tanaka', caption:'Tanaka — mirror fit 🪞', date: '2025-09-08', author:'Tanaka' as UserId },
    { id:'s-tanaka-quote', image: '/photos/tanaka-quote.png', label:'Tanaka', caption:'“I got my brothers, I don’t need friends”', date: '2025-09-05', author:'Tanaka' as UserId },
    { id:'s-tanaka-embarrassing', image: '/photos/tanaka-embarrassing.png', label:'Tanaka', caption:'Embarrassing pic 😂', date: '2025-09-03', author:'Tanaka' as UserId },
    { id:'s-tanaka-baby', image: '/photos/tanaka-baby.png', label:'Tanaka', caption:'Me and my baby ❤️', date: '2025-09-01', author:'Tanaka' as UserId },
  ],[photo, memories, who])
  const [viewedStories,setViewedStories]=useState<Set<string>>(()=> new Set(LS.get<string[]>('td_viewed_stories',[])))
  useEffect(()=> LS.set('td_viewed_stories', Array.from(viewedStories)),[viewedStories])
  const [activeStory,setActiveStory]=useState<number|null>(null)
  // auto-advance like IG
  useEffect(()=>{
    if(activeStory===null) return
    const id=setTimeout(()=>{
      if(activeStory < stories.length-1) setActiveStory(a=> a===null?null:a+1)
      else setActiveStory(null)
    }, 5200)
    return ()=> clearTimeout(id)
  },[activeStory, stories.length])
  // mark viewed on open
  useEffect(()=>{ if(activeStory!==null){ const sid=stories[activeStory]?.id; if(sid) setViewedStories(s=> new Set([...s, sid])) }},[activeStory, stories])

  // scroll nav
  const [active,setActive]=useState('home')
  useEffect(()=>{
    const ids=['home','board','notes','memories','question']
    const obs=new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting) setActive(e.target.id)})
    },{ rootMargin:'-45% 0px -50% 0px', threshold:0})
    ids.forEach(id=>{ const el=document.getElementById(id); if(el) obs.observe(el)})
    return ()=> obs.disconnect()
  },[])

  return (
    <div className="app">
      {/* gate — must be Tanaka or Diane */}
      {!gateAuth && (
        <div className="gate-overlay">
          <div className="gate-card">
            {gateStep===0 ? (
              <>
                <div className="gate-emoji">🔒</div>
                <h2>Yo... this is some personal shi inside,</h2>
                <p>if you arent <b>Tanaka</b> or <b>Diane</b> then go find a life of your own</p>
                <button className="btn-primary" style={{marginTop:14, width:'100%'}} onClick={()=> setGateStep(1)}>Continue →</button>
                <div className="small muted" style={{marginTop:10, fontFamily:'Caveat', fontSize:14, textAlign:'center'}}>Made for you and me ❤️ — Tanaka & Diane</div>
              </>
            ) : gateStep===1 ? (
              <>
                <div className="gate-emoji">🔑</div>
                <h2>Enter pin to access</h2>
                <p className="small muted" style={{marginTop:4}}>Only Tanaka & Diane know this one.</p>
                <div style={{display:'flex', gap:8, marginTop:14}}>
                  <input
                    value={gatePin}
                    onChange={e=> { setGatePin(e.target.value.replace(/\D/g,'')); setGateErr(null)}}
                    onKeyDown={e=> e.key==='Enter' && submitGate()}
                    placeholder="••••••"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    style={{flex:1, borderRadius:999, border:'1px solid var(--border)', background:'rgba(245,239,232,0.06)', color:'var(--cream)', padding:'12px 16px', fontSize:18, letterSpacing:'0.3em', textAlign:'center', outline:'none'}}
                  />
                  <button className="btn-primary" onClick={submitGate}>Enter</button>
                </div>
                {gateErr && <div className="small" style={{marginTop:8, color:'var(--accent-2)', textAlign:'center'}}>{gateErr}</div>}
                <button className="btn-ghost btn-small" style={{marginTop:10, width:'100%'}} onClick={()=> setGateStep(0)}>← back</button>
              </>
            ) : (
              <>
                <div className="gate-emoji">👋</div>
                <h2>Who are you?</h2>
                <p className="small muted" style={{marginTop:4}}>Tanaka or Diane — your pin will tell me.</p>
                <div style={{display:'flex', gap:8, marginTop:14}}>
                  <button className={`btn-ghost ${gateChoice==='Tanaka'?'active':''}`} style={{flex:1, borderRadius:999, padding:'12px', border: gateChoice==='Tanaka' ? '1px solid var(--cream)' : '1px solid var(--border)', background: gateChoice==='Tanaka' ? 'var(--cream)' : 'transparent', color: gateChoice==='Tanaka' ? '#1a1210' : 'var(--cream)'}} onClick={()=> { setGateChoice('Tanaka'); setGateUserErr(null)}}>Tanaka</button>
                  <button className={`btn-ghost ${gateChoice==='Diane'?'active':''}`} style={{flex:1, borderRadius:999, padding:'12px', border: gateChoice==='Diane' ? '1px solid var(--cream)' : '1px solid var(--border)', background: gateChoice==='Diane' ? 'var(--cream)' : 'transparent', color: gateChoice==='Diane' ? '#1a1210' : 'var(--cream)'}} onClick={()=> { setGateChoice('Diane'); setGateUserErr(null)}}>Diane</button>
                </div>
                <div style={{display:'flex', gap:8, marginTop:12}}>
                  <input
                    value={gateUserPin}
                    onChange={e=> { setGateUserPin(e.target.value.replace(/\D/g,'')); setGateUserErr(null)}}
                    onKeyDown={e=> e.key==='Enter' && submitWho()}
                    placeholder={gateChoice ? `PIN for ${gateChoice}` : 'Pick Tanaka or Diane first'}
                    inputMode="numeric"
                    disabled={!gateChoice}
                    maxLength={4}
                    style={{flex:1, borderRadius:999, border:'1px solid var(--border)', background: gateChoice ? 'rgba(245,239,232,0.06)' : 'rgba(245,239,232,0.03)', color:'var(--cream)', padding:'12px 16px', fontSize:18, letterSpacing:'0.4em', textAlign:'center', outline:'none', opacity: gateChoice ? 1 : 0.5}}
                  />
                  <button className="btn-primary" onClick={submitWho}>Enter</button>
                </div>
                <div className="small muted" style={{marginTop:6, textAlign:'center'}}>Diane: 1111 • Tanaka: 0000</div>
                {gateUserErr && <div className="small" style={{marginTop:8, color:'var(--accent-2)', textAlign:'center'}}>{gateUserErr}</div>}
                <button className="btn-ghost btn-small" style={{marginTop:10, width:'100%'}} onClick={()=> setGateStep(1)}>← back</button>
              </>
            )}
          </div>
        </div>
      )}
      {/* faded morphing ambient blobs — subtle when idle, alive when playing */}
      <div className={`ambient ${playing ? 'playing' : ''}`} aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
      </div>
      {/* topbar */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand" onClick={tapHeart} style={{cursor:'pointer'}}>Tanaka <span style={{color:'#e63946'}}>❤</span> Diane <i>— {heartTaps>0? `${5-heartTaps} taps to secret` : ''}</i></div>
          <nav className="nav">
            <a href="#home" className={active==='home'?'active':''}>Home</a>
            <a href="#board" className={active==='board'?'active':''}>Blackboard</a>
            <a href="#notes" className={active==='notes'?'active':''}>Notes</a>
            <a href="#memories" className={active==='memories'?'active':''}>Memories</a>
            <a href="#question" className={active==='question'?'active':''}>Question</a>
            <a href="#workshop" onClick={(e)=>{e.preventDefault(); setShowWorkshop(true)}} style={{color:'var(--accent-2)'}}>Workshop</a>
          </nav>
          <div className="whoami">
            <button className={who==='Tanaka'?'active':''} onClick={()=>setWho('Tanaka')}>Tanaka</button>
            <button className={who==='Diane'?'active':''} onClick={()=>setWho('Diane')}>Diane</button>
          </div>
        </div>
      </header>

      {toast && <div className="toast">❤️ {toast}</div>}
      {secret && <div className="toast" style={{top:116, background:'#1a1210', color:'#f5efe8', border:'1px solid var(--border)'}}>{secret}</div>}
      {thinking && <div className="toast" style={{top:116}}>{thinking.from} is thinking about you ❤️</div>}

      {/* hearts overlay */}
      <div className="hearts">
        {hearts.map(h=> (
          <span key={h.id} className="heart-float" style={{left: `${20+Math.random()*60}%`, ['--dx' as string]: `${(Math.random()-0.5)*120}px`}}>❤️</span>
        ))}
      </div>

      {isToday && (
        <div className="celebration">
          <div>
            <h1>TODAY ❤️</h1>
            <p>After all that waiting…<br/>I finally get to see you.</p>
            <div style={{marginTop:18, fontSize:32}}>🎉 ❤️ 🎉</div>
            <p style={{marginTop:18, fontFamily:'Caveat', fontSize:22}}>Tanaka ❤️ Diane — We made it.</p>
            <button className="btn-primary" style={{marginTop:20}} onClick={()=> setToast('Play our song? Press 🎵 below!') as unknown as void}>We made it ❤️</button>
            <div className="hearts">
              {Array.from({length:18}).map((_,i)=> <span key={i} className="heart-float" style={{left:`${5+i*5}%`, animationDelay:`${i*0.08}s`, ['--dx' as string]:`${(Math.random()-0.5)*80}px`}}>❤️</span>)}
            </div>
          </div>
        </div>
      )}

      {/* instagram stories — top bar (mobile + desktop) */}
      <div className="story-bar">
        {stories.map((s, idx)=>(
          <button key={s.id} className={`story-item ${viewedStories.has(s.id)?'':'active'}`} onClick={()=> setActiveStory(idx)} style={{background:'transparent', border:0, padding:0}}>
            <div className={`story-ring ${viewedStories.has(s.id)?'viewed':''}`}>
              <img src={s.image} alt={s.label} loading="lazy" onError={e=> ((e.target as HTMLImageElement).style.opacity='0.6')} />
            </div>
            <div className="story-label">{s.label}</div>
          </button>
        ))}
        <button className="story-item" onClick={()=> { document.getElementById('memories')?.scrollIntoView({behavior:'smooth'}); setToast('Add a new memory to get a new story ❤️'); setTimeout(()=>setToast(null),2000)}} style={{background:'transparent', border:0, padding:0}}>
          <div className="story-ring" style={{background:'rgba(245,239,232,0.08)', display:'grid', placeItems:'center', fontSize:20, color:'var(--muted)'}}>+</div>
          <div className="story-label">New</div>
        </button>
      </div>

      {/* floating edge stories — desktop framing, like instagram edges */}
      <div className="edge-stories left" aria-hidden={false}>
        {stories.slice(0,3).map((s,idx)=>(
          <button key={'l-'+s.id} className={`edge-bubble ${viewedStories.has(s.id)?'viewed':''}`} onClick={()=> setActiveStory(idx)} aria-label={s.label} style={{border:0, padding:'3px', background: viewedStories.has(s.id)?'rgba(245,239,232,0.14)':undefined}}>
            <img src={s.image} alt={s.label} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="edge-stories right" aria-hidden={false}>
        {stories.slice(3,6).map((s,idx)=>(
          <button key={'r-'+s.id} className={`edge-bubble ${viewedStories.has(s.id)?'viewed':''}`} onClick={()=> setActiveStory(idx+3)} aria-label={s.label} style={{border:0, padding:'3px', background: viewedStories.has(s.id)?'rgba(245,239,232,0.14)':undefined}}>
            <img src={s.image} alt={s.label} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* story viewer */}
      {activeStory!==null && stories[activeStory] && (
        <div className="story-viewer" onClick={()=> setActiveStory(null)}>
          <div className="story-viewer-backdrop" />
          <div className="story-viewer-card" onClick={e=> e.stopPropagation()}>
            <div className="story-progress">
              {stories.map((_,i)=>(
                <i key={i} className={i < activeStory! ? 'done' : i===activeStory ? 'active' : ''}><em /></i>
              ))}
            </div>
            <div className="story-viewer-top">
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <img src={stories[activeStory].image} alt="" style={{width:32, height:32, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(255,255,255,0.9)'}} />
                <div>
                  <div style={{fontSize:13, fontWeight:700}}>{stories[activeStory].label} • {stories[activeStory].author}</div>
                  <div style={{fontSize:11, opacity:.75}}>{stories[activeStory].date}</div>
                </div>
              </div>
              <button onClick={()=> setActiveStory(null)} style={{background:'rgba(0,0,0,0.35)', border:0, color:'#fff', width:32, height:32, borderRadius:'50%', display:'grid', placeItems:'center', cursor:'pointer'}}>✕</button>
            </div>
            <div className="story-viewer-img">
              <img src={stories[activeStory].image} alt={stories[activeStory].caption} />
              <div className="story-viewer-caption">
                <h4>{stories[activeStory].caption}</h4>
                <p>Tap left/right to browse • {activeStory+1} / {stories.length}</p>
              </div>
              <div className="story-nav-hit left" onClick={()=> setActiveStory(a=> a===null?null: Math.max(0, a-1))} />
              <div className="story-nav-hit right" onClick={()=> setActiveStory(a=> a===null?null: a+1 < stories.length ? a+1 : null)} />
            </div>
          </div>
        </div>
      )}

      <main className="shell">
        {/* HERO */}
        <section id="home" className="hero">
          <h1>Tanaka <span>❤</span> Diane</h1>
          <div className="handwritten">Our little corner of the internet.</div>

          <div className="photo-polaroid">
            <div className="pin" />
            <img src={photo} alt="Tanaka & Diane" onError={(e)=> (e.currentTarget.src='/photos/us-collage.png')} style={photo.includes('us-collage') ? {aspectRatio:'9/13', objectFit:'cover', objectPosition:'center top'} : undefined} />
            <div className="caption">Us ❤️ — Tanaka & Diane</div>
          </div>

          <div className="count-card">
            <div className="count-label">Until I see you again…</div>
            <div className="count-grid">
              <div className="count-unit"><b>{String(countdown.days).padStart(2,'0')}</b><span>Days</span></div>
              <div className="count-unit"><b>{String(countdown.hours).padStart(2,'0')}</b><span>Hours</span></div>
              <div className="count-unit"><b>{String(countdown.minutes).padStart(2,'0')}</b><span>Minutes</span></div>
              <div className="count-unit"><b>{String(countdown.seconds).padStart(2,'0')}</b><span>Seconds</span></div>
            </div>
            <div className="count-sub">Every second is one second closer to you.</div>
            <div className="heart-pulse">❤️</div>
            {milestone && <div className="milestone">{milestone}</div>}
            <div className="actions">
              <button className="btn-soft" onClick={sendThinking}>I'm thinking of you ❤️</button>
              <button className="btn-primary" onClick={sendLove}>Send a little love ❤️</button>
            </div>
            <div className="small muted" style={{textAlign:'center', marginTop:10}}>Tap to let {who==='Tanaka'?'Diane':'Tanaka'} feel it instantly — real-time ✨</div>
          </div>

          {/* time together — met date covered up */}
          <div className="section">
            <div style={{maxWidth:680, margin:'0 auto', background:'rgba(245,239,232,0.04)', border:'1px solid var(--border)', borderRadius:18, padding:'18px 16px', textAlign:'left'}}>
              <div style={{fontFamily:'Playfair Display', fontSize:15}}>Until December 4th</div>
              <div style={{fontFamily:'Cormorant Garamond', fontStyle:'italic', color:'var(--muted)', marginTop:4}}>Every day is one day closer to you.</div>
              <div className="row" style={{justifyContent:'space-between', marginTop:14, fontSize:13}}>
                <span><b>{daysUntil}</b> days until we meet ❤️</span>
                <span className="muted" style={{fontFamily:'Caveat', fontSize:14}}>December 4, 2026</span>
              </div>
              {!hideMet && (
                <>
                  <div className="progress" style={{opacity:0.9}}><i style={{width: `${progressPct}%`}} /></div>
                  <div className="small muted" style={{marginTop:8, display:'flex', justifyContent:'space-between'}}>
                    <span>since we found each other</span><span>{progressPct}% of the wait is behind us ❤️</span><span>{new Date(meetingISO).toLocaleDateString()}</span>
                  </div>
                </>
              )}
              {hideMet && (
                <div className="small" style={{marginTop:10, fontFamily:'Caveat', fontSize:16, color:'var(--accent-2)'}}>We've been waiting — and loving every second of it. See you soon, love.</div>
              )}
            </div>
          </div>

          {/* personal message */}
          <div className="section" style={{maxWidth:680, margin:'28px auto 0', textAlign:'left'}}>
            <button className="letter-card letter-toggle" onClick={()=> setLetterOpen(o=>!o)} style={{width:'100%'}}>
              <div>
                <h3 style={{fontFamily:'Playfair Display', fontSize:16}}>A little something from Tanaka…</h3>
                <span>{letterOpen?'tap to close':'tap to open — written just for you, Diane'}</span>
              </div>
              <span style={{fontSize:18}}>{letterOpen?'−':'+'}</span>
            </button>
            {letterOpen && (
              <div className="letter-card" style={{marginTop:12, textAlign:'center', padding:'28px 20px'}}>
                <div style={{fontFamily:'Playfair Display', fontSize:'clamp(22px, 6vw, 34px)', fontWeight:700, lineHeight:1.15, color:'#1a1210', letterSpacing:'-0.02em'}}>{message}</div>
                <div className="letter-meta" style={{marginTop:14}}>— Tanaka 😂❤️</div>
              </div>
            )}
          </div>

          <div className="small muted" style={{marginTop:18, fontFamily:'Caveat', fontSize:15}}>Hi Diane ❤️ — Yes, I actually made this for you 😂❤️</div>
        </section>

        {/* BLACKBOARD */}
        <section id="board" className="section">
          <div className="section-head"><h2>Our Blackboard <em>🖤</em></h2><p>draw together, in real-time</p></div>
          <p className="section-desc">A little school blackboard that belongs to just us. Scribble, draw hearts, leave jokes — it'll be here when you come back.</p>
          <div className="board-wrap">
            <div className="board-top">
              <span>● ● ●</span>
              <b>{isDrawing ? boardStatus : 'Our board ❤️'}</b>
              <span style={{fontSize:11, opacity:.7}}>{who} • live</span>
            </div>
            <canvas
              ref={canvasRef}
              className="board-canvas"
              onMouseDown={startDraw}
              onMouseMove={moveDraw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={moveDraw}
              onTouchEnd={endDraw}
            />
            <div className="board-tools">
              <button className={`tool-btn ${tool==='chalk'?'active':''}`} onClick={()=>setTool('chalk')}>✏️ Chalk</button>
              <button className={`tool-btn ${tool==='eraser'?'active':''}`} onClick={()=>setTool('eraser')}>🧽 Erase</button>
              <span style={{display:'flex', gap:6, alignItems:'center', marginLeft:4}}>
                {['#ffffff','#ffd166','#ff8fa3','#a8dadc','#b5e48c'].map(c=>(
                  <button key={c} className="chalk" style={{background:c, opacity: color===c?1:0.6, transform: color===c?'scale(1.2)':''}} onClick={()=>{setColor(c); setTool('chalk')}} aria-label={c}/>
                ))}
              </span>
              <span style={{flex:1}}/>
              <button className="tool-btn" onClick={undo}>↩︎ Undo</button>
              <button className="tool-btn" onClick={redo}>↪︎ Redo</button>
              <button className="tool-btn" onClick={clearBoard}>Clear</button>
            </div>
          </div>
          <div className="row" style={{marginTop:12}}>
            <button className="btn-primary btn-small" onClick={()=>{
              const c2=canvasRef.current; if(!c2) return
              const ctx2=c2.getContext('2d')!
              ctx2.fillStyle=color; ctx2.font='20px Caveat'; ctx2.fillText(who==='Tanaka'?'Leave something for Diane ❤️':'Leave something for Tanaka ❤️', 20, 60)
              pushHistory(); saveBoard()
            }}>Leave something for {who==='Tanaka'?'Diane':'Tanaka'} ❤️</button>
            <span className="small muted">Draw “I MISS YOU ❤️” — {who==='Tanaka'?'Diane':'Tanaka'} sees it appear live.</span>
          </div>
          <div className="small" style={{marginTop:10, fontFamily:'Caveat', fontSize:15, color:'var(--muted)'}}>Don't pretend you didn't smile. — Tanaka</div>
        </section>

        {/* NOTES */}
        <section id="notes" className="section">
          <div className="section-head"><h2>Little things <em>I wanted to tell you</em></h2><p>{notes.length} little notes</p></div>
          <p className="section-desc">Tiny paper notes — for the thoughts that are too small for a message but too big to keep to yourself.</p>
          <div className="note-input">
            <input value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder={who==='Tanaka'?'Leave a note for Diane…':'Leave a note for Tanaka…'} onKeyDown={e=> e.key==='Enter' && addNote()} />
            <button onClick={addNote}>Leave it ❤️</button>
          </div>
          <div className="notes-grid" style={{marginTop:14}}>
            {notes.map(n=>(
              <div key={n.id} className="note">
                <div className="note-text">“{n.text}”</div>
                <div className="note-meta"><span>{n.author} • {n.date}</span><span>❤️</span></div>
              </div>
            ))}
          </div>
          <div className="small muted" style={{marginTop:10, textAlign:'center', fontFamily:'Caveat', fontSize:15}}>I hope this makes you smile. — T</div>
        </section>

        {/* MEMORIES */}
        <section id="memories" className="section">
          <div className="section-head"><h2>Our memories <em>📸</em></h2><p>our scrapbook</p></div>
          <p className="section-desc">Not perfect. Just us. Exactly how I want to remember it.</p>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
            <input placeholder="Caption — e.g. This moment ❤️" value={memDraft.caption} onChange={e=> setMemDraft(s=>({...s, caption:e.target.value}))} style={{flex:'1 1 160px', borderRadius:999, border:'1px solid var(--border)', background:'rgba(245,239,232,0.06)', color:'var(--cream)', padding:'10px 14px', fontSize:13, outline:'none'}} />
            <input placeholder="Image URL" value={memDraft.image} onChange={e=> setMemDraft(s=>({...s, image:e.target.value}))} style={{flex:'1 1 160px', borderRadius:999, border:'1px solid var(--border)', background:'rgba(245,239,232,0.06)', color:'var(--cream)', padding:'10px 14px', fontSize:13, outline:'none'}} />
            <input placeholder="Little story…" value={memDraft.text} onChange={e=> setMemDraft(s=>({...s, text:e.target.value}))} style={{flex:'1 1 220px', borderRadius:999, border:'1px solid var(--border)', background:'rgba(245,239,232,0.06)', color:'var(--cream)', padding:'10px 14px', fontSize:13, outline:'none'}} />
            <button className="btn-primary btn-small" onClick={addMemory}>Add to scrapbook</button>
          </div>
          <div className="masonry">
            {memories.map(m=>(
              <div key={m.id} className="memory">
                <img src={m.image} alt={m.caption} loading="lazy" onError={e=> ((e.target as HTMLImageElement).style.display='none')} />
                <div className="memory-body">
                  <h4>{m.caption}</h4>
                  <p>{m.text}</p>
                  <div className="memory-meta">{m.author} • {hideMet && m.date===metISO.slice(0,10) ? '—' : m.date} • ❤️</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DAILY QUESTION */}
        <section id="question" className="section">
          <div className="section-head"><h2>A question <em>for us</em></h2><p>one a day</p></div>
          <div className="question-card">
            <div className="small muted" style={{letterSpacing:'0.1em', textTransform:'uppercase', fontSize:11}}>{todayStr} • for Tanaka & Diane</div>
            <h3>“{daily.question}”</h3>
            {daily.tanaka && daily.diane ? (
              <>
                <div style={{marginTop:12, fontFamily:'Caveat', fontSize:18, color:'var(--accent-2)'}}>You both answered ❤️</div>
                <div className="answers">
                  <div className="answer-box"><h5>Tanaka</h5><p>{daily.tanaka}</p></div>
                  <div className="answer-box"><h5>Diane</h5><p>{daily.diane}</p></div>
                </div>
              </>
            ) : (
              <>
                <textarea value={answerDraft} onChange={e=>setAnswerDraft(e.target.value)} placeholder={`Your answer, ${who}…`} />
                <div className="row" style={{justifyContent:'center', marginTop:12}}>
                  <button className="btn-primary" onClick={()=>{
                    if(!answerDraft.trim()) return
                    const next={...daily, [who.toLowerCase()]: answerDraft.trim()} as DailyAnswer
                    setDaily(next); setAnswerDraft('')
                    if(isSupabase && supabase){
                      supabase!.from('daily_answers').upsert({ date: next.date, question: next.question, tanaka: (next as any).tanaka || null, diane: (next as any).diane || null, updated_at: new Date().toISOString() }, { onConflict:'date'}).then(()=>{})
                    }
                    if(!next.tanaka || !next.diane) { setToast('Answer saved — waiting for the other one ❤️'); setTimeout(()=>setToast(null),2400)}
                  }}>Save my answer ❤️</button>
                  <span className="small muted">{daily.tanaka || daily.diane ? 'One of you answered — the other answer stays hidden until both are in.' : 'Answers stay hidden until you both answer.'}</span>
                </div>
                {(daily.tanaka || daily.diane) && <div className="small" style={{marginTop:10, color:'var(--accent-2)'}}>{daily.tanaka?'Tanaka':'Diane'} already answered — shhh, not peeking until you both do 😉</div>}
              </>
            )}
          </div>
          <div className="small muted" style={{marginTop:10, textAlign:'center'}}>Come back tomorrow. — there'll be a new one waiting.</div>
        </section>

        {/* WORKSHOP */}
        <section id="workshop" className="section">
          <div className="section-head"><h2>Tanaka's Workshop <em>🔧</em></h2><p>private — just for Tanaka</p></div>
          {!pinOk ? (
            <div className="workshop" style={{textAlign:'center'}}>
              <div style={{fontFamily:'Caveat', fontSize:18}}>This is Tanaka's little workshop. Enter the pin to edit our world.</div>
              <div className="small muted">Hint: the day we met (DDMM)</div>
              <div style={{display:'flex', gap:8, justifyContent:'center', marginTop:12}}>
                <input value={pin} onChange={e=>setPin(e.target.value)} placeholder="PIN" style={{maxWidth:140, textAlign:'center'}} maxLength={6} />
                <button className="btn-primary btn-small" onClick={tryPin}>Enter</button>
              </div>
              <button className="btn-ghost btn-small" style={{marginTop:10}} onClick={()=>{ setPinOk(true); LS.set('td_pin_ok',true); setShowWorkshop(true)}}>I'm Diane — just looking 👀</button>
            </div>
          ) : !showWorkshop ? (
            <div className="workshop" style={{textAlign:'center'}}>
              <button className="btn-primary" onClick={()=>setShowWorkshop(true)}>Open Workshop</button>
              <button className="btn-ghost btn-small" style={{marginLeft:8}} onClick={()=>{ setPinOk(false); LS.set('td_pin_ok', false)}}>Lock</button>
            </div>
          ) : (
            <div className="workshop">
              <div className="row" style={{justifyContent:'space-between'}}>
                <h3>Tanaka's Workshop</h3>
                <button className="btn-ghost btn-small" onClick={()=> setShowWorkshop(false)}>Close</button>
              </div>
              <label>Meeting date — 4 December 2026 ❤️</label>
              <input type="datetime-local" value={meetingISO.slice(0,16)} onChange={e=> setMeetingISO(new Date(e.target.value).toISOString())} />
              <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10}}>
                <span>We met on {hideMet ? '(hidden — covered up)' : ''}</span>
                <label style={{display:'flex', alignItems:'center', gap:6, fontSize:11, letterSpacing:0, textTransform:'none', color:'var(--muted)', cursor:'pointer'}}>
                  <input type="checkbox" checked={hideMet} onChange={e=> setHideMet(e.target.checked)} /> Hide date
                </label>
              </label>
              {!hideMet && <input type="date" value={metISO.slice(0,10)} onChange={e=> setMetISO(new Date(e.target.value).toISOString())} />}
              {hideMet && <div className="small muted" style={{padding:'10px 12px', border:'1px dashed var(--border)', borderRadius:12, background:'rgba(245,239,232,0.04)'}}>Covered up — Diane & Tanaka keep this one between us. Uncheck “Hide date” if you want to set it.</div>}
              <label>Photo — Us ❤️</label>
              <input value={photo} onChange={e=> setPhoto(e.target.value)} placeholder="https://..." />
              <div style={{marginTop:8, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                <label className="btn-ghost btn-small" style={{cursor:'pointer', border:'1px dashed var(--border)', display:'inline-flex', alignItems:'center', gap:6}}>
                  📸 Upload photo
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
                    const f=e.target.files?.[0]; if(!f) return;
                    const r=new FileReader(); r.onload=()=>{ setPhoto(r.result as string); setToast('Photo updated ❤️'); setTimeout(()=>setToast(null),2000)}; r.readAsDataURL(f)
                  }} />
                </label>
                <span className="small muted">or paste URL above — image saves instantly</span>
              </div>

              <label>Our song 🎵 — {songName}</label>
              <input value={songUrl} onChange={e=> setSongUrl(e.target.value)} placeholder="https://... or /our-song.mp3" />
              <div style={{marginTop:8, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                <label className="btn-primary btn-small" style={{cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6}}>
                  🎵 Choose song file
                  <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac" style={{display:'none'}} onChange={e=>{
                    const f=e.target.files?.[0]; if(!f) return;
                    if(f.size > 12*1024*1024){ setToast('That file is huge (>12MB) — try a smaller mp3 or place it in public/ and use URL'); setTimeout(()=>setToast(null),3500); return}
                    const r=new FileReader();
                    r.onload=()=>{
                      try{
                        const data=r.result as string;
                        setSongUrl(data); setSongName(f.name.replace(/\.[^/.]+$/,''));
                        setToast(`“${f.name}” is now our song ❤️ — tap Play`); setTimeout(()=>setToast(null),3000)
                      }catch{ setToast('Could not read file'); setTimeout(()=>setToast(null),2000)}
                    };
                    r.onerror=()=> { setToast('Could not read that file'); setTimeout(()=>setToast(null),2000)}
                    r.readAsDataURL(f)
                  }} />
                </label>
                <button className="btn-ghost btn-small" onClick={()=>{
                  const a=document.createElement('a'); a.href=songUrl; a.download=songName+'.mp3'; if(songUrl.startsWith('data:')) a.click(); else { navigator.clipboard.writeText(songUrl); setToast('Song URL copied'); setTimeout(()=>setToast(null),1800)}
                }}>Copy / Download</button>
                <span className="small muted">mp3/m4a/wav/ogg — plays offline after upload. For large files, drop the file into <code>public/our-song.mp3</code> and set URL to <code>/our-song.mp3</code></span>
              </div>
              {songUrl && <audio controls src={songUrl} style={{width:'100%', marginTop:10, borderRadius:12}} preload="metadata" />}

              <label>Our video 🎬 — {videoName || 'no video yet'}</label>
              <input value={videoUrl} onChange={e=> setVideoUrl(e.target.value)} placeholder="https://... or /our-video.mp4 (optional)" />
              <div style={{marginTop:8, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                <label className="btn-primary btn-small" style={{cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, background:'#ff3b6e'}}>
                  🎬 Choose video file
                  <input type="file" accept="video/*,.mp4,.mov,.m4v,.webm" style={{display:'none'}} onChange={e=>{
                    const f=e.target.files?.[0]; if(!f) return;
                    if(f.size > 80*1024*1024){ setToast('Video too big (>80MB) — compress or drop in public/ and use URL /our-video.mp4'); setTimeout(()=>setToast(null),4000); return}
                    // try to use object URL for big files, or data URL for small
                    if(f.size > 12*1024*1024){
                      // copy via temp URL — instruct to move to public for persistence
                      const url=URL.createObjectURL(f);
                      setVideoUrl(url); setVideoName(f.name.replace(/\.[^/.]+$/,''));
                      setToast(`“${f.name}” loaded — for permanent save, move file to public/our-video.mp4 and set URL to /our-video.mp4`); setTimeout(()=>setToast(null),4200)
                    } else {
                      const r=new FileReader();
                      r.onload=()=>{ setVideoUrl(r.result as string); setVideoName(f.name.replace(/\.[^/.]+$/,'')); setToast(`Video “${f.name}” ready — tap Play to morph ❤️`); setTimeout(()=>setToast(null),3000)};
                      r.readAsDataURL(f)
                    }
                  }} />
                </label>
                <button className="btn-ghost btn-small" onClick={()=>{ setVideoUrl(''); setVideoName(''); setVideoOpen(false); setToast('Video removed'); setTimeout(()=>setToast(null),1600)}}>Remove</button>
                <span className="small muted">When set, tapping <b>Play</b> morphs the pill into fullscreen video — iOS-like spring. Drop large video in <code>public/our-video.mp4</code> → URL <code>/our-video.mp4</code></span>
              </div>
              {videoUrl && <video src={videoUrl} controls muted playsInline style={{width:'100%', marginTop:10, borderRadius:16, maxHeight:240, background:'#000'}} />}
              <label>Letter — A little something from Tanaka</label>
              <textarea value={message} onChange={e=> setMessage(e.target.value)} rows={6} />
              <label>Open When letters</label>
              {openWhen.map((l,idx)=>(
                <div key={l.id} style={{border:'1px solid var(--border)', borderRadius:12, padding:12, marginTop:8}}>
                  <input value={l.title} onChange={e=>{
                    const c=[...openWhen]; c[idx]={...c[idx], title:e.target.value}; setOpenWhen(c)
                  }} placeholder="Title" style={{marginBottom:6}} />
                  <textarea value={l.content} onChange={e=>{
                    const c=[...openWhen]; c[idx]={...c[idx], content:e.target.value}; setOpenWhen(c)
                  }} rows={4} />
                </div>
              ))}
              <div className="row" style={{marginTop:14}}>
                <button className="btn-ghost btn-small" onClick={clearBoard}>Clear blackboard for both</button>
                <button className="btn-ghost btn-small" onClick={()=>{ localStorage.clear(); location.reload()}}>Reset all (careful)</button>
              </div>
              <div className="small muted" style={{marginTop:10}}>All changes save instantly on this device and sync live to the other via BroadcastChannel / localStorage. For true cross-device sync, plug in Supabase (see README).</div>
            </div>
          )}
        </section>

        <div className="footer">Made for you and me ❤️ — Tanaka & Diane</div>
        <div className="small muted" style={{textAlign:'center', marginTop:8, fontFamily:'Cormorant Garamond', fontStyle:'italic'}}>You found this. I hope this makes you smile. — T</div>
      </main>

      {/* bottom nav */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <a href="#home" className={active==='home'?'active':''}><i>❤️</i>Home</a>
          <a href="#board" className={active==='board'?'active':''}><i>🖤</i>Board</a>
          <a href="#notes" className={active==='notes'?'active':''}><i>💌</i>Notes</a>
          <a href="#memories" className={active==='memories'?'active':''}><i>📸</i>Memories</a>
          <a href="#question" className={active==='question'?'active':''}><i>💭</i>Question</a>
        </div>
      </nav>

      {/* music pill — itself is the player, stays at bottom, expands in place */}
      <div className={`music-bar ${videoOpen ? 'video-open' : ''}`}>
        {!videoOpen ? (
          <div className="pill-row">
            <button onClick={handlePlayToggle} aria-label="Play our song">{playing?'❚❚':'▶'}</button>
            <div style={{fontSize:12, minWidth:0, flex:1}}>
              <div style={{fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'42vw', fontFamily:'Playfair Display'}}>Our Song</div>
              <div className="small muted" style={{fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'42vw'}}>Secondhand - Don Toliver ft Rema</div>
            </div>
            {videoUrl && <button className="btn-ghost btn-small" style={{borderRadius:999, padding:'6px 12px', whiteSpace:'nowrap'}} onClick={handleSeeVideo}>See Video 🎬</button>}
            <button className="btn-ghost btn-small" style={{borderRadius:999, padding:'6px 12px'}} onClick={()=> { setShowWorkshop(true); document.getElementById('workshop')?.scrollIntoView({behavior:'smooth'}); }}>♪</button>
          </div>
        ) : (
          <>
            <div className="pill-header">
              <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
                <div style={{width:32, height:32, borderRadius:'50%', background:'var(--cream)', color:'#1a1210', display:'grid', placeItems:'center', fontSize:13, flexShrink:0}}>🎵</div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:700, fontFamily:'Playfair Display'}}>Our Song</div>
                  <div className="small muted" style={{fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Secondhand - Don Toliver ft Rema • {playing?'playing':'paused'}</div>
                </div>
              </div>
              <button className="btn-ghost btn-small" style={{borderRadius:999, padding:'6px 12px', flexShrink:0}} onClick={closeVideoMorph}>Hide ✕</button>
            </div>
            <div className="pill-video-wrap">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                autoPlay
                playsInline
                loop
                onPlay={()=> setPlaying(true)}
                onPause={()=> setPlaying(false)}
                onEnded={()=> setPlaying(false)}
              />
            </div>
            <div className="pill-controls">
              <button className="btn-primary btn-small" onClick={()=> {
                if(videoRef.current){ if(videoRef.current.paused) videoRef.current.play(); else videoRef.current.pause() }
              }}>{playing?'❚❚ Pause':'▶ Play'}</button>
              <button className="btn-ghost btn-small" onClick={closeVideoMorph}>Hide</button>
              <span className="small muted" style={{marginLeft:'auto', fontFamily:'Caveat', fontSize:13}}>same pill, now playing ❤️</span>
            </div>
          </>
        )}
      </div>
      <audio ref={audioRef} src={songUrl} loop preload="metadata" onError={()=> { if(songUrl) { setToast('Could not play that file — try re-uploading'); setTimeout(()=>setToast(null),2800)} }} />

      {/* hidden surprise */}
      <button onClick={()=> { setSecret("Tanaka loves you more than he admits. — always."); setTimeout(()=>setSecret(null),3000)}} style={{position:'fixed', bottom:90, right:14, width:22, height:22, borderRadius:'50%', background:'transparent', border:'1px dashed rgba(245,239,232,0.12)', color:'transparent', cursor:'pointer'}} aria-label="secret">.</button>
    </div>
  )
}
