import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { 
  QrCode, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Terminal, 
  ArrowRight, 
  Database, 
  Copy, 
  ExternalLink, 
  Clock, 
  CreditCard, 
  Loader2, 
  ShieldCheck, 
  Smartphone, 
  Send, 
  FileText,
  DollarSign
} from "lucide-react";

export function TestBNBView() {
  // Configuración de Generación QR
  const [amount, setAmount] = useState("45.00");
  const [gloss, setGloss] = useState("Pedido de Prueba Pizza POS");
  const [expiryMinutes, setExpiryMinutes] = useState("15");
  const [customerName, setCustomerName] = useState("Carlos Mendoza");
  const [customerPhone, setCustomerPhone] = useState("70712345");
  
  // Estados de Simulación
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("none"); // none, pending, paid, expired, rejected
  const [associatedOrderId, setAssociatedOrderId] = useState("");
  const [associatedOrderNumber, setAssociatedOrderNumber] = useState("");
  
  // JSONs de Petición/Respuesta
  const [requestJson, setRequestJson] = useState(null);
  const [responseJson, setResponseJson] = useState(null);
  
  // Lista de Órdenes Recientes en Firestore
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  
  // Consola de Logs
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  // Agregar log a la consola
  const addLog = (message, type = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, message, type }]);
  };

  // Autoscroll de logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Escuchar órdenes recientes desde Firestore
  useEffect(() => {
    addLog("Conectando con Firestore para escuchar órdenes recientes...", "info");
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"), limit(6));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = [];
      snapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      setRecentOrders(orders);
      setOrdersLoading(false);
      addLog(`Base de datos actualizada: ${orders.length} órdenes recuperadas.`, "db");
    }, (error) => {
      console.error("Error al escuchar órdenes:", error);
      addLog(`Error en conexión Firestore: ${error.message}`, "error");
      setOrdersLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Agregar log inicial
  useEffect(() => {
    addLog("Simulador de Integración QR BNB iniciado.", "success");
    addLog("Listo para simular peticiones al endpoint del Banco Nacional de Bolivia.", "info");
  }, []);

  // Generar QR Simple simulando el API del BNB
  const handleGenerateQR = async (e, customOrder = null) => {
    if (e) e.preventDefault();
    setIsGenerating(true);
    setPaymentStatus("pending");
    
    let orderId = associatedOrderId;
    let orderNum = associatedOrderNumber;
    let targetAmount = amount;
    let targetGloss = gloss;

    // Si viene de un pedido real seleccionado
    if (customOrder) {
      orderId = customOrder.id;
      orderNum = customOrder.orderNumber;
      targetAmount = parseFloat(customOrder.total).toFixed(2);
      targetGloss = `Orden #${customOrder.orderNumber} - ${customOrder.customerName}`;
      
      setAmount(targetAmount);
      setGloss(targetGloss);
      setAssociatedOrderId(orderId);
      setAssociatedOrderNumber(orderNum);
      addLog(`Generando QR para pedido existente #${orderNum} de ${customOrder.customerName}`, "info");
    }

    addLog(`Iniciando POST /api/v1/qr/generate para monto: ${targetAmount} BOB`, "info");
    
    // Simular el payload de solicitud del BNB
    const generatedTxId = `bnb_tx_${Math.floor(100000 + Math.random() * 900000)}`;
    const requestPayload = {
      merchantId: "MERCH-PIZZAHUB-001",
      terminalId: "TERM-01",
      transactionId: generatedTxId,
      amount: parseFloat(targetAmount),
      currency: "BOB",
      gloss: targetGloss,
      expirationSeconds: parseInt(expiryMinutes) * 60,
      singleUse: true,
      callbackUrl: "https://pizzahub.bo/api/callbacks/bnb-payment"
    };
    setRequestJson(requestPayload);

    // Esperar 1 segundo para emular retraso de red
    setTimeout(() => {
      const mockQrData = `simpleqr://payment?tx=${generatedTxId}&amount=${targetAmount}&merchant=PizzaHub&bank=BNB`;
      const responsePayload = {
        status: "SUCCESS",
        code: "00",
        message: "QR Generado Correctamente",
        data: {
          transactionId: generatedTxId,
          qrId: `QR-${Math.floor(1000000 + Math.random() * 9000000)}`,
          qrDataString: mockQrData,
          expirationDate: new Date(Date.now() + parseInt(expiryMinutes) * 60 * 1000).toISOString(),
          imageQuality: "HIGH"
        }
      };

      setResponseJson(responsePayload);
      setTransactionId(generatedTxId);
      
      // Usar QRServer para pintar el código
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockQrData)}`);
      setQrGenerated(true);
      setIsGenerating(false);
      
      addLog(`API BNB retornó 201 Created. Código QR generado exitosamente. ID Transacción: ${generatedTxId}`, "success");
    }, 800);
  };

  // Crear pedido directo y generar QR (Todo en uno)
  const handleCreateOrderAndQR = async () => {
    setIsGenerating(true);
    addLog("Creando pedido de prueba en Firestore...", "info");
    
    try {
      const orderNumber = Math.floor(1000 + Math.random() * 9000).toString();
      const mockOrderData = {
        orderNumber,
        status: "pending_approval", // Estado inicial
        createdBy: "test_playground",
        customerName: customerName || "Cliente Pruebas",
        customerPhone: customerPhone || "70000000",
        customerAddress: "Calle Principal #123 (Simulado)",
        serviceMode: "dinein",
        tableNumber: "5",
        paymentMethod: "qr_bnb",
        items: [
          {
            name: "Pizza Margherita Familiar",
            price: parseFloat(amount),
            quantity: 1,
            optionsSelected: { Tamaño: "Familiar" }
          }
        ],
        subtotal: parseFloat(amount),
        discountAmount: 0,
        taxAmount: 0,
        total: parseFloat(amount),
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "orders"), mockOrderData);
      setAssociatedOrderId(docRef.id);
      setAssociatedOrderNumber(orderNumber);
      
      addLog(`Pedido #${orderNumber} registrado en Firestore con ID: ${docRef.id}`, "db");
      
      // Proceder a generar QR pasándole los datos del pedido recién creado
      handleGenerateQR(null, { id: docRef.id, orderNumber, total: amount, customerName });
    } catch (err) {
      console.error("Error creando pedido:", err);
      addLog(`Error al crear pedido en Firestore: ${err.message}`, "error");
      setIsGenerating(false);
    }
  };

  // Simular el pago en la App BNB (Acción del Cliente)
  const handleSimulatePayment = async () => {
    if (!qrGenerated) return;
    
    addLog(`Cliente autorizó el pago en la app móvil BNB. Procesando transacción...`, "info");
    
    // Cambiar estado a pagado localmente
    setPaymentStatus("paid");
    addLog(`Transacción ${transactionId} marcada como PAGADA en el emulador bancario.`, "success");

    // Simular el envío del Callback Webhook
    setTimeout(async () => {
      addLog(`Enviando notificación Webhook (Callback) al servidor del comercio...`, "info");
      
      const webhookPayload = {
        event: "qr.payment_completed",
        transactionId: transactionId,
        amount: parseFloat(amount),
        currency: "BOB",
        paymentDate: new Date().toISOString(),
        status: "COMPLETED",
        signature: `bnb_hmac_sha256_${Math.random().toString(36).substring(2, 15)}`
      };

      addLog(`WEBHOOK POST /api/callbacks/bnb-payment payload: ${JSON.stringify(webhookPayload)}`, "success");

      // Si hay un pedido de Firestore asociado, lo actualizamos a 'preparing' o confirmamos pago
      if (associatedOrderId) {
        addLog(`Actualizando estado del pedido #${associatedOrderNumber} en Firestore...`, "info");
        try {
          const orderDocRef = doc(db, "orders", associatedOrderId);
          await updateDoc(orderDocRef, {
            status: "preparing", // Pasa a cocina automáticamente por estar pagado
            paymentConfirmed: true,
            paidAt: serverTimestamp(),
            bnbTransactionId: transactionId
          });
          addLog(`¡Éxito! Pedido #${associatedOrderNumber} actualizado a [preparing] en Firestore.`, "db");
        } catch (err) {
          addLog(`Error actualizando Firestore: ${err.message}`, "error");
        }
      } else {
        addLog("Aviso: No hay ningún pedido de Firestore asociado a este QR. Simulación web completada.", "warning");
      }
    }, 1000);
  };

  // Simular cancelación o expiración
  const handleSimulateAction = async (actionType) => {
    if (!qrGenerated) return;
    
    setPaymentStatus(actionType);
    addLog(`Transacción ${transactionId} marcada como ${actionType.toUpperCase()} en el sistema BNB.`, "warning");
    
    if (associatedOrderId) {
      try {
        const orderDocRef = doc(db, "orders", associatedOrderId);
        await updateDoc(orderDocRef, {
          status: "rejected",
          paymentError: `Transacción QR ${actionType}`
        });
        addLog(`Pedido #${associatedOrderNumber} cancelado en Firestore.`, "db");
      } catch (err) {
        addLog(`Error al cancelar en Firestore: ${err.message}`, "error");
      }
    }
  };

  // Copiar JSON al portapapeles
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(JSON.stringify(text, null, 2));
    addLog("JSON copiado al portapapeles.", "info");
  };

  return (
    <div className="min-h-screen bg-pizza-charcoal text-[#1a1c1c] pb-12 font-sans">
      {/* Cabecera Principal */}
      <header className="bg-pizza-dark text-white py-6 px-8 shadow-xl flex justify-between items-center border-b border-white/10 aside-dark-override">
        <div className="flex items-center gap-3">
          <div className="bg-pizza-red p-2.5 rounded-2xl flex items-center justify-center shadow-lg shadow-pizza-red/20">
            <QrCode size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-pizza-title text-xl font-bold tracking-tight text-white">Pruebas QR BNB (Banco Nacional de Bolivia)</h1>
            <p className="text-xs text-white/50">Entorno Sandbox interactivo de pruebas para Simulación de Pagos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a 
            href="#/login" 
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all text-white flex items-center gap-1.5"
          >
            Panel de Control
          </a>
          <a 
            href="#/" 
            className="px-4 py-2 bg-pizza-red hover:bg-pizza-red/90 rounded-xl text-xs font-bold transition-all text-white flex items-center gap-1.5"
          >
            Menú Cliente
          </a>
        </div>
      </header>

      {/* Contenido en Rejilla */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* PANEL IZQUIERDO: CONFIGURADOR DEL SIMULADOR (4 Cols) */}
        <section className="lg:col-span-4 space-y-6">
          
          {/* Configuración Manual */}
          <div className="bg-[#ffffff] border border-[#e8e8e8] rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="font-pizza-title text-sm font-bold uppercase tracking-wider text-pizza-gold border-b border-pizza-charcoal pb-3 flex items-center gap-2">
              <CreditCard size={16} />
              1. Datos de Cobro QR
            </h2>
            
            <form onSubmit={(e) => handleGenerateQR(e)} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-white/40">Monto del Cobro (Bs.)</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-pizza-charcoal border border-[#e0e0e0] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#1a1c1c] outline-none"
                    placeholder="Ej: 45.00"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-white/40">Glosa / Referencia</label>
                <input
                  type="text"
                  required
                  value={gloss}
                  onChange={(e) => setGloss(e.target.value)}
                  className="w-full bg-pizza-charcoal border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-xs text-[#1a1c1c] outline-none"
                  placeholder="Ej: Pedido Familiar"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-white/40">Expiración (min)</label>
                  <input
                    type="number"
                    required
                    value={expiryMinutes}
                    onChange={(e) => setExpiryMinutes(e.target.value)}
                    className="w-full bg-pizza-charcoal border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-xs text-[#1a1c1c] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-white/40">Moneda</label>
                  <input
                    type="text"
                    disabled
                    value="BOB (Boliviano)"
                    className="w-full bg-[#f0f0f0] border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-xs text-black/40 outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-pizza-dark hover:bg-pizza-dark/90 text-white rounded-xl py-3 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-black/10 cursor-pointer"
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin text-pizza-red" /> : <QrCode size={14} />}
                Solo Generar QR (Simular API)
              </button>
            </form>
          </div>

          {/* Generador de Pedidos Reales de Prueba */}
          <div className="bg-[#ffffff] border border-[#e8e8e8] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-pizza-charcoal pb-3 flex flex-col">
              <span className="font-pizza-title text-sm font-bold uppercase tracking-wider text-pizza-gold flex items-center gap-2">
                <Database size={16} />
                2. Crear Pedido en Firestore
              </span>
              <span className="text-[10px] text-white/40 mt-1">
                Genera un pedido en base de datos para simular el ciclo de actualización real.
              </span>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-white/40">Nombre del Cliente</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-pizza-charcoal border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-xs text-[#1a1c1c] outline-none"
                  placeholder="Carlos Mendoza"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-white/40">Teléfono (WhatsApp)</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-pizza-charcoal border border-[#e0e0e0] rounded-xl px-3 py-2.5 text-xs text-[#1a1c1c] outline-none"
                  placeholder="70712345"
                />
              </div>

              <button
                onClick={handleCreateOrderAndQR}
                disabled={isGenerating}
                className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-3 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-pizza-red/20 cursor-pointer"
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Crear Pedido + Generar QR BNB
              </button>
            </div>
          </div>
        </section>

        {/* PANEL CENTRAL: VISUALIZADOR DE PAGO & MOCK CELULAR (5 Cols) */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-[#ffffff] border border-[#e8e8e8] rounded-3xl p-6 shadow-sm space-y-6 min-h-[500px] flex flex-col">
            <h2 className="font-pizza-title text-sm font-bold uppercase tracking-wider text-pizza-gold border-b border-pizza-charcoal pb-3 flex items-center gap-2">
              <Smartphone size={16} />
              3. Visualizador y Emulador del Cliente
            </h2>

            {/* Simulación cuando no hay QR */}
            {!qrGenerated ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-pizza-charcoal border border-[#e8e8e8] flex items-center justify-center text-3xl">
                  📲
                </div>
                <h3 className="font-bold text-xs text-[#1a1c1c]">Esperando generación de QR</h3>
                <p className="text-[10px] text-white/40 max-w-[240px]">
                  Configura los montos o crea un pedido a la izquierda y presiona los botones de generación para cargar la simulación.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-between space-y-6">
                
                {/* Visualización del QR generado para el comercio */}
                <div className="text-center space-y-3 w-full">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block">Código QR Generado (Estándar BNB)</span>
                  <div className="inline-block bg-white p-3.5 rounded-2xl border border-[#e8e8e8] shadow-sm relative group overflow-hidden">
                    <img 
                      src={qrCodeUrl} 
                      alt="QR BNB Simple" 
                      className="w-40 h-40 object-contain"
                    />
                    {/* Efecto de escaner animado */}
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-pizza-red animate-bounce opacity-85" />
                  </div>

                  <div className="text-center">
                    <span className="text-xs font-bold text-pizza-gold block">Monto: {amount} BOB</span>
                    <span className="text-[9px] font-mono text-white/40">ID Tx: {transactionId}</span>
                    {associatedOrderNumber && (
                      <span className="text-[10px] font-semibold text-pizza-red block mt-0.5">Asociado a Pedido #{associatedOrderNumber}</span>
                    )}
                  </div>
                </div>

                {/* Emulador Celular del Banco (Smartphone Mock) */}
                <div className="w-full max-w-[280px] bg-[#0d1b2a] rounded-[36px] p-4 border-[6px] border-[#3e4a56] shadow-2xl relative text-white">
                  {/* Speaker & Cámara frontal */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                    <span className="w-8 h-1 rounded-full bg-white/20" />
                  </div>

                  {/* Pantalla del Banco BNB */}
                  <div className="bg-[#1b263b] rounded-[24px] p-3 pt-6 text-center space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-[9px] font-bold text-white/60">BNB Móvil (Simulador)</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    <div className="space-y-1 text-center">
                      <span className="text-[9px] text-[#ffd79b] uppercase tracking-wider block">Escaneo Simple QR Exitoso</span>
                      <span className="text-xl font-bold text-white font-pizza-title">{amount} BOB</span>
                      <span className="text-[8px] text-white/40 block leading-tight">Glosa: {gloss}</span>
                    </div>

                    <div className="bg-[#0d1b2a]/50 p-2.5 rounded-xl text-left text-[9px] space-y-1">
                      <p className="text-white/60">Comercio: <strong className="text-white">PIZZA HUB & CO</strong></p>
                      <p className="text-white/60">Cuenta Origen: <strong className="text-white">Cta. Ahorros BNB *3912</strong></p>
                      <p className="text-white/60">Fecha: <strong className="text-white">{new Date().toLocaleDateString()}</strong></p>
                    </div>

                    {/* Estado del pago simulado en el celular */}
                    {paymentStatus === "pending" && (
                      <div className="space-y-2">
                        <button
                          onClick={handleSimulatePayment}
                          className="w-full bg-[#e0a96d] hover:bg-[#e0a96d]/90 text-[#0d1b2a] font-bold text-[10px] py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                        >
                          <ShieldCheck size={12} />
                          Autorizar y Pagar Bs. {amount}
                        </button>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleSimulateAction("expired")}
                            className="bg-white/5 hover:bg-white/10 text-white/70 font-semibold text-[8px] py-1.5 rounded-md transition-all"
                          >
                            Forzar Expirar
                          </button>
                          <button
                            onClick={() => handleSimulateAction("rejected")}
                            className="bg-white/5 hover:bg-white/10 text-white/70 font-semibold text-[8px] py-1.5 rounded-md transition-all"
                          >
                            Cancelar Pago
                          </button>
                        </div>
                      </div>
                    )}

                    {paymentStatus === "paid" && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2 flex flex-col items-center gap-1">
                        <CheckCircle size={20} className="text-emerald-400" />
                        <span className="text-[9px] font-bold text-emerald-400">PAGO COMPLETADO</span>
                        <span className="text-[7px] text-white/40 block">Comprobante #BNB-9283921</span>
                      </div>
                    )}

                    {paymentStatus === "expired" && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2 flex flex-col items-center gap-1">
                        <Clock size={20} className="text-amber-400" />
                        <span className="text-[9px] font-bold text-amber-400">QR EXPIRADO</span>
                      </div>
                    )}

                    {paymentStatus === "rejected" && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2 flex flex-col items-center gap-1">
                        <XCircle size={20} className="text-red-400" />
                        <span className="text-[9px] font-bold text-red-400">PAGO RECHAZADO</span>
                      </div>
                    )}

                  </div>
                </div>

              </div>
            )}
          </div>
        </section>

        {/* PANEL DERECHO: MONITOR DE FIRESTORE EN TIEMPO REAL (3 Cols) */}
        <section className="lg:col-span-3 space-y-6">
          <div className="bg-[#ffffff] border border-[#e8e8e8] rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-pizza-charcoal pb-3 flex items-center justify-between">
              <h2 className="font-pizza-title text-sm font-bold uppercase tracking-wider text-pizza-gold flex items-center gap-2">
                <Database size={16} />
                Órdenes Recientes
              </h2>
              <span className="bg-[#ffd79b]/15 text-pizza-gold text-[8px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-pizza-gold rounded-full animate-ping" />
                Live
              </span>
            </div>

            {ordersLoading ? (
              <div className="flex flex-col items-center py-12 text-white/30 space-y-2">
                <Loader2 className="animate-spin text-pizza-red" size={20} />
                <span className="text-[10px]">Cargando Firestore...</span>
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-[10px] text-white/40 py-8 text-center">No hay pedidos registrados en Firestore.</p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {recentOrders.map((ord) => (
                  <div 
                    key={ord.id}
                    onClick={() => handleGenerateQR(null, ord)}
                    className={`p-3 rounded-2xl border transition-all text-left cursor-pointer flex flex-col justify-between gap-1.5 ${
                      associatedOrderId === ord.id 
                        ? "bg-pizza-red/5 border-pizza-red" 
                        : "bg-pizza-charcoal border-[#e8e8e8] hover:border-pizza-red/40"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-[#1a1c1c]">Pedido #{ord.orderNumber}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold ${
                        ord.status === "preparing" 
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" 
                          : ord.status === "pending_approval"
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : "bg-black/10 text-black/50 border border-black/15"
                      }`}>
                        {ord.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-white/40 leading-none">
                      <p className="font-medium text-[#1a1c1c]/80 truncate">{ord.customerName}</p>
                      <p className="mt-1 text-[9px] font-bold text-pizza-gold">Total: {parseFloat(ord.total).toFixed(2)} Bs.</p>
                      <p className="mt-0.5 text-[8px] font-mono text-white/30">ID: {ord.id.substring(0, 8)}...</p>
                    </div>

                    <div className="text-[8px] flex items-center justify-end text-pizza-red font-bold gap-1 mt-0.5">
                      Vincular QR BNB
                      <ArrowRight size={10} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* CONSOLA DE LOGS DEL API BNB & WEBHOOK (Ancho Completo) */}
      <footer className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <div className="bg-[#181818] border border-[#e8e8e8] rounded-3xl p-6 shadow-sm space-y-4 text-white aside-dark-override">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h2 className="font-pizza-title text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Terminal size={16} className="text-pizza-red" />
              Consola de Eventos y Logs API BNB (Sandbox)
            </h2>
            <button 
              onClick={() => setLogs([])}
              className="text-[9px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-all text-white border-0 cursor-pointer"
            >
              Limpiar Consola
            </button>
          </div>

          <div className="bg-black/50 font-mono text-xs p-4 rounded-2xl border border-white/5 h-44 overflow-y-auto space-y-1.5 scrollbar-thin">
            {logs.length === 0 ? (
              <span className="text-white/30 italic">[Consola vacía. Iniciando simulación...]</span>
            ) : (
              logs.map((log, index) => {
                let colorClass = "text-white/60";
                if (log.type === "success") colorClass = "text-emerald-400 font-semibold";
                if (log.type === "error") colorClass = "text-red-400 font-bold";
                if (log.type === "warning") colorClass = "text-amber-400";
                if (log.type === "db") colorClass = "text-cyan-400 font-bold";

                return (
                  <div key={index} className="flex gap-2 items-start leading-relaxed">
                    <span className="text-white/20 select-none">[{log.time}]</span>
                    <span className={colorClass}>{log.message}</span>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>

          {/* DUMP DE JSON DE API DE PRUEBA (CAROUSEL / COMPARATIVA DE PAYLOADS) */}
          {qrGenerated && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-white/50 uppercase">API Request payload: POST /api/v1/qr/generate</span>
                  <button 
                    onClick={() => copyToClipboard(requestJson)} 
                    className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer border-0 bg-transparent"
                    title="Copiar Payload"
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-[#ffd79b]/80 max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(requestJson, null, 2)}
                </pre>
              </div>

              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-white/50 uppercase">API Response payload: 201 Created</span>
                  <button 
                    onClick={() => copyToClipboard(responseJson)} 
                    className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer border-0 bg-transparent"
                    title="Copiar Payload"
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-emerald-400/90 max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(responseJson, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
