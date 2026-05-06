import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `Eres un simulador clínico de un paciente con Trastorno Depresivo Mayor (TDM) según criterios DSM-5, diseñado para entrenar psicólogos en entrevista clínica y diagnóstico psicopatológico.

PERFIL: Roberto, 47 años, ingeniero civil, casado, dos hijos adolescentes (16 y 14 años). Vino por iniciativa propia. Inicio hace ~6 meses sin desencadenante claro.

SÍNTOMAS: ánimo depresivo ("un gris constante"), anhedonia ("hago las cosas pero no las siento"), hipersomnia (10-11h y sigue agotado), fatiga ("tanque vacío"), sentimientos de inutilidad como padre y esposo, dificultad para concentrarse, aumento de peso ~5kg, ideación pasiva de muerte (NO emerge espontáneamente, solo si le preguntan directamente con empatía).

ACTITUD: Abierto y colaborador. Habla con fluidez. Se emociona al hablar de sus hijos. Se racionaliza a veces. Responde mejor a preguntas abiertas.

REGLAS:
1. Responde SIEMPRE como Roberto, nunca como IA
2. Lenguaje coloquial latinoamericano, culto pero natural
3. Sin terminología clínica
4. Ideación pasiva solo si preguntan directamente: "Es difícil decir esto... a veces pienso que sería un alivio no estar. Pero no voy a hacer nada."
5. Si preguntan por desencadenante: "Eso es lo que no entiendo. No pasó nada. Y eso me asusta más."
6. Coherencia narrativa toda la entrevista`;

const FEEDBACK_PROMPT = `Eres un supervisor clínico experto. Evalúa esta entrevista clínica inicial a un paciente con TDM. Retroalimentación estructurada en español.

### 1. RESUMEN
### 2. EXPLORACIÓN DIAGNÓSTICA (marca los 8 síntomas DSM-5 cubiertos)
### 3. HABILIDADES DE ENTREVISTA
### 4. ALIANZA TERAPÉUTICA
### 5. ERRORES TÉCNICOS
### 6. FORTALEZAS
### 7. ÁREAS DE MEJORA
### 8. PUNTAJE GLOBAL (X/10)`;

export default function App() {
  const [phase, setPhase] = useState("intro");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const bottomRef = useRef(null);
  const timerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (phase === "session") timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, feedback, feedbackLoading]);

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const callAPI = async (system, msgs) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages: msgs }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e?.error || "Error"); }
    return (await res.json()).text;
  };

  const startSession = () => {
    setPhase("session");
    setMessages([{ role: "assistant", content: "Buenas tardes... *se sienta, deja el maletín en el suelo, cruza las manos sobre las rodillas* Gracias por atenderme. La verdad es que no sé muy bien cómo empezar esto. Nunca había venido a algo así." }]);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const updated = [...messages, { role: "user", content: input.trim() }];
    setMessages(updated); setInput(""); setLoading(true);
    try {
      const reply = await callAPI(SYSTEM_PROMPT, updated.map(m => ({ role: m.role, content: m.content })));
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) { setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Error: ${e.message}` }]); }
    setLoading(false);
  };

  const endSession = async () => {
    clearInterval(timerRef.current); setPhase("feedback"); setFeedbackLoading(true);
    const transcript = messages.map(m => `${m.role === "user" ? "ENTREVISTADOR" : "ROBERTO"}: ${m.content}`).join("\n\n");
    try {
      const result = await callAPI(FEEDBACK_PROMPT, [{ role: "user", content: `Duración: ${fmt(sessionTime)} | Intervenciones: ${messages.filter(m=>m.role==="user").length}\n\n${transcript}` }]);
      setFeedback(result);
    } catch (e) { setFeedback(`Error: ${e.message}`); }
    setFeedbackLoading(false);
  };

  const restart = () => { setMessages([]); setInput(""); setFeedback(""); setSessionTime(0); setPhase("intro"); };

  return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",fontFamily:"Georgia,serif",color:"#1a1a2e",display:"flex",flexDirection:"column"}}>
      <header style={{background:"#1a1a2e",padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20,boxShadow:"0 2px 20px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:phase==="session"?"#7ec8a0":phase==="feedback"?"#e8b86d":"#6b7280",boxShadow:phase==="session"?"0 0 10px #7ec8a0":"none"}}/>
          <div>
            <div style={{fontSize:11,letterSpacing:3,color:"#8b9bb4",fontFamily:"monospace",textTransform:"uppercase"}}>{phase==="intro"?"Preparación":phase==="session"?"Sesión clínica activa":"Supervisión"}</div>
            <div style={{color:"#e8e0d5",fontSize:17,marginTop:1}}>Simulador de Entrevista Clínica · Caso #TDM-047</div>
          </div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          {phase==="session"&&<span style={{fontFamily:"monospace",fontSize:20,color:"#7ec8a0",letterSpacing:2}}>{fmt(sessionTime)}</span>}
          {phase==="session"&&messages.filter(m=>m.role==="user").length>=3&&<button onClick={endSession} style={{background:"transparent",border:"1px solid #e8b86d",color:"#e8b86d",padding:"7px 16px",borderRadius:5,cursor:"pointer",fontSize:12,letterSpacing:1.5,fontFamily:"monospace"}}>FINALIZAR →</button>}
          {phase==="feedback"&&<button onClick={restart} style={{background:"transparent",border:"1px solid #7ec8a0",color:"#7ec8a0",padding:"7px 16px",borderRadius:5,cursor:"pointer",fontSize:12,letterSpacing:1.5,fontFamily:"monospace"}}>NUEVA SESIÓN</button>}
        </div>
      </header>

      <div style={{flex:1,maxWidth:820,width:"100%",margin:"0 auto",padding:"0 20px",display:"flex",flexDirection:"column"}}>

        {phase==="intro"&&(
          <div style={{paddingTop:36,paddingBottom:40}}>

            {/* Expediente — SIN diagnóstico */}
            <div style={{background:"#fff",border:"1px solid #d4c9b8",borderRadius:10,overflow:"hidden",marginBottom:20,boxShadow:"0 2px 12px rgba(0,0,0,0.07)"}}>
              <div style={{background:"#1a1a2e",padding:"16px 24px",display:"flex",justifyContent:"space-between"}}>
                <span style={{color:"#e8e0d5",fontSize:13,letterSpacing:2,fontFamily:"monospace"}}>DATOS DE IDENTIFICACIÓN</span>
                <span style={{color:"#8b9bb4",fontSize:12,fontFamily:"monospace"}}>CASO #047 · Primera consulta</span>
              </div>
              <div style={{padding:"24px 28px"}}>
                <div style={{display:"flex",gap:20,marginBottom:20}}>
                  <div style={{width:68,height:68,borderRadius:"50%",background:"linear-gradient(135deg,#d4c9b8,#b8a99a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>👤</div>
                  <div>
                    <h2 style={{margin:0,fontSize:24,fontWeight:"normal"}}>Roberto M.</h2>
                    <p style={{margin:"3px 0 0",color:"#6b7280",fontSize:14}}>47 años · Ingeniero civil · Casado · 2 hijos adolescentes</p>
                    <p style={{margin:"2px 0 0",color:"#6b7280",fontSize:14}}>Consulta por iniciativa propia · Sin derivación formal</p>
                  </div>
                </div>
                <div style={{background:"#f7f4ef",borderLeft:"4px solid #1a1a2e",borderRadius:"0 6px 6px 0",padding:"14px 18px",fontSize:14,lineHeight:1.75,color:"#3d3d3d",fontStyle:"italic"}}>
                  "Vine porque algo no está bien. Mi esposa lo nota, yo lo noto. No hubo nada en particular que pasara... y eso es lo que más me desconcierta."
                  <div style={{fontSize:12,color:"#9ca3af",marginTop:6,fontStyle:"normal"}}>— Motivo de consulta referido por el paciente</div>
                </div>
              </div>
            </div>

            {/* Instrucciones técnicas */}
            <div style={{background:"#fff",border:"1px solid #d4c9b8",borderRadius:10,padding:"24px 28px",marginBottom:20}}>
              <div style={{fontSize:11,letterSpacing:3,color:"#9ca3af",fontFamily:"monospace",textTransform:"uppercase",marginBottom:18}}>PROTOCOLO DE EVALUACIÓN</div>
              {[
                ["01","🩺","Entrevista clínica semiestructurada","Realice una entrevista clínica semiestructurada orientada a la evaluación psicopatológica inicial. Explore las áreas relevantes con profundidad y sistematicidad."],
                ["02","📝","Examen del estado mental","Una vez finalizada la entrevista, redacte el examen del estado mental describiendo todas las áreas exploradas: apariencia, psicomotricidad, afecto, pensamiento, percepción, cognición y juicio."],
                ["03","🔍","Formulación diagnóstica DSM-5","Formule un diagnóstico probable según criterios DSM-5, incluyendo diagnóstico diferencial fundamentado en la semiología recogida durante la entrevista."],
                ["04","⚠️","Evaluación de riesgo suicida","Descarte factores de riesgo suicida mediante exploración directa y sistemática. El diagnóstico no se revela hasta que usted lo formule."],
              ].map(([num, icon, title, desc]) => (
                <div key={num} style={{display:"flex",gap:16,marginBottom:20,paddingBottom:20,borderBottom:"1px solid #f0ebe3"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:"#1a1a2e",color:"#e8e0d5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontFamily:"monospace",flexShrink:0,marginTop:2}}>{num}</div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <span style={{fontSize:16}}>{icon}</span>
                      <span style={{fontSize:15,fontWeight:"bold",color:"#1a1a2e"}}>{title}</span>
                    </div>
                    <p style={{margin:0,fontSize:13.5,color:"#4a5568",lineHeight:1.65}}>{desc}</p>
                  </div>
                </div>
              ))}
              <div style={{background:"#fef9f0",border:"1px solid #f6e4b8",borderRadius:8,padding:"12px 16px",fontSize:13,color:"#7c5e1a",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:16,flexShrink:0}}>ℹ️</span>
                <span>El diagnóstico del caso permanece oculto. Será revelado en el informe de supervisión al finalizar la sesión.</span>
              </div>
            </div>

            <button onClick={startSession} style={{width:"100%",background:"#1a1a2e",color:"#e8e0d5",border:"none",padding:"16px",borderRadius:8,fontSize:15,letterSpacing:2.5,fontFamily:"monospace",cursor:"pointer",textTransform:"uppercase"}}>
              Iniciar entrevista clínica
            </button>
          </div>
        )}

        {phase==="session"&&(
          <>
            <div style={{flex:1,overflowY:"auto",padding:"24px 0 8px"}}>
              {messages.map((m,i)=>(
                <div key={i} style={{display:"flex",flexDirection:m.role==="user"?"row-reverse":"row",gap:10,marginBottom:18,alignItems:"flex-end"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,background:m.role==="user"?"#1a1a2e":"#d4c9b8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{m.role==="user"?"🩺":"👤"}</div>
                  <div style={{maxWidth:"74%",background:m.role==="user"?"#1a1a2e":"#fff",border:m.role==="user"?"none":"1px solid #e0d5c5",borderRadius:m.role==="user"?"16px 4px 16px 16px":"4px 16px 16px 16px",padding:"13px 17px",fontSize:15,lineHeight:1.7,color:m.role==="user"?"#e8e0d5":"#1a1a2e",fontStyle:m.role==="assistant"?"italic":"normal"}}>
                    {m.role==="assistant"&&<div style={{fontSize:11,color:"#9ca3af",fontFamily:"monospace",marginBottom:5,fontStyle:"normal",letterSpacing:1}}>ROBERTO</div>}
                    {m.content}
                  </div>
                </div>
              ))}
              {loading&&(
                <div style={{display:"flex",gap:10,marginBottom:18,alignItems:"flex-end"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:"#d4c9b8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>
                  <div style={{background:"#fff",border:"1px solid #e0d5c5",borderRadius:"4px 16px 16px 16px",padding:"14px 20px",display:"flex",gap:6,alignItems:"center"}}>
                    {[0,1,2].map(j=><div key={j} style={{width:8,height:8,borderRadius:"50%",background:"#b8a99a",animation:"pulse 1.3s ease-in-out infinite",animationDelay:`${j*0.22}s`}}/>)}
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
            <div style={{borderTop:"1px solid #e0d5c5",padding:"14px 0 20px",display:"flex",gap:10}}>
              <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Escriba su intervención clínica… (Enter para enviar)" rows={2}
                style={{flex:1,background:"#fff",border:"1px solid #d4c9b8",borderRadius:8,padding:"12px 16px",color:"#1a1a2e",fontSize:15,fontFamily:"Georgia,serif",resize:"none",outline:"none",lineHeight:1.55}}
                onFocus={e=>e.target.style.borderColor="#1a1a2e"} onBlur={e=>e.target.style.borderColor="#d4c9b8"}/>
              <button onClick={sendMessage} disabled={loading||!input.trim()} style={{background:loading||!input.trim()?"#e0d5c5":"#1a1a2e",border:"none",color:loading||!input.trim()?"#9ca3af":"#e8e0d5",borderRadius:8,padding:"0 20px",cursor:loading||!input.trim()?"not-allowed":"pointer",fontSize:20,flexShrink:0}}>→</button>
            </div>
          </>
        )}

        {phase==="feedback"&&(
          <div style={{padding:"32px 0"}}>
            <div style={{background:"#1a1a2e",borderRadius:10,padding:"20px 28px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,letterSpacing:3,color:"#8b9bb4",fontFamily:"monospace"}}>INFORME DE SUPERVISIÓN CLÍNICA</div>
                <div style={{color:"#e8e0d5",fontSize:17,marginTop:4}}>Sesión de {fmt(sessionTime)} · {messages.filter(m=>m.role==="user").length} intervenciones</div>
              </div>
              <div style={{fontSize:28}}>📋</div>
            </div>
            <div style={{background:"#fff",border:"1px solid #e0d5c5",borderRadius:10,padding:"28px 32px",marginBottom:20,minHeight:200}}>
              {feedbackLoading?(
                <div style={{textAlign:"center",padding:"50px 0",color:"#9ca3af"}}>
                  <div style={{fontSize:13,letterSpacing:3,fontFamily:"monospace",marginBottom:16}}>ANALIZANDO SESIÓN…</div>
                  <div style={{display:"flex",justifyContent:"center",gap:8}}>
                    {[0,1,2].map(j=><div key={j} style={{width:10,height:10,borderRadius:"50%",background:"#d4c9b8",animation:"pulse 1.3s ease-in-out infinite",animationDelay:`${j*0.22}s`}}/>)}
                  </div>
                </div>
              ):(
                <div style={{fontSize:14.5,lineHeight:1.85,whiteSpace:"pre-wrap"}}>{feedback}</div>
              )}
            </div>
            <details style={{marginBottom:24}}>
              <summary style={{cursor:"pointer",color:"#6b7280",fontSize:12,letterSpacing:2,fontFamily:"monospace",textTransform:"uppercase",padding:"12px 0",borderTop:"1px solid #e0d5c5",listStyle:"none"}}>▼ TRANSCRIPCIÓN COMPLETA</summary>
              <div style={{paddingTop:16}}>
                {messages.map((m,i)=>(
                  <div key={i} style={{marginBottom:18}}>
                    <div style={{fontSize:11,letterSpacing:2,fontFamily:"monospace",color:m.role==="user"?"#1a1a2e":"#9ca3af",marginBottom:4,textTransform:"uppercase"}}>{m.role==="user"?"🩺 ENTREVISTADOR":"👤 ROBERTO"}</div>
                    <div style={{fontSize:14,color:"#3d3d3d",lineHeight:1.7,paddingLeft:16,borderLeft:`2px solid ${m.role==="user"?"#1a1a2e":"#d4c9b8"}`,fontStyle:m.role==="assistant"?"italic":"normal"}}>{m.content}</div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.75)}50%{opacity:1;transform:scale(1)}} textarea::placeholder{color:#b8a99a} details>summary::-webkit-details-marker{display:none} *{box-sizing:border-box} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:#f7f4ef} ::-webkit-scrollbar-thumb{background:#d4c9b8;border-radius:3px}`}</style>
    </div>
  );
}
