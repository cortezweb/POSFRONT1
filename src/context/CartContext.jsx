/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { getProductPriceWithExtras } from "../utils/formatters";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0); // Porcentaje (0-100)
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingDistance, setShippingDistance] = useState(0);
  const [serviceMode, setServiceMode] = useState("pickup"); // 'pickup' | 'delivery' | 'dinein'
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCoords, setCustomerCoords] = useState(null);
  
  // Parámetros del negocio leídos en tiempo real de Firestore
  const [businessConfig, setBusinessConfig] = useState({
    currency: "USD",
    whatsappNumber: "+51999999999",
    vCardEnabled: true,
    yapeQrUrl: "",
    maintenanceMessage: "El local se encuentra cerrado temporalmente.",
    tax: { taxEnabled: true, taxRate: 18, taxIncluded: false, taxName: "IGV" },
    discounts: {
      coupons: { "PIZZALOVE": 20 },
      autoDiscounts: [
        { minAmount: 500, discountPercent: 10 },
        { minAmount: 1000, discountPercent: 15 },
        { minAmount: 1500, discountPercent: 20 }
      ]
    },
    shipping: {
      shippingMode: "distance",
      shippingCostPerKm: 1.5,
      businessLocation: { lat: -12.046374, lng: -77.031002 }, // Lima Centro por defecto
      shippingZones: []
    },
    serviceModes: { delivery: true, pickup: true, dineIn: true, tableNumbers: 20, tableLabel: "Mesa" }
  });

  // Suscribirse a los cambios de configuración
  useEffect(() => {
    const docRef = doc(db, "config", "settings");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusinessConfig(data);
        
        // Actualizar título de la pestaña del navegador dinámicamente en todo el proyecto
        if (data.name) {
          document.title = `${data.name} | Menú Digital & POS Express`;
          
          // Actualizar meta-descripción dinámicamente para mejorar SEO en todo el proyecto
          const metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc) {
            metaDesc.setAttribute("content", `Ordena tus pizzas y platillos favoritos en ${data.name} con nuestra VCard digital integrada. Servicio rápido de delivery, recojo o consumo en local.`);
          }
        }
      }
    }, (error) => {
      console.warn("No se pudo cargar la configuración de Firestore. Usando defaults locales.", error);
    });
    return () => unsubscribe();
  }, []);

  const addToCart = (product, quantity = 1, optionsSelected = {}, comboItems = []) => {
    // Generar un ID único en el carrito para diferenciar el mismo producto con personalizaciones distintas
    const cartId = `${product.id}-${JSON.stringify(optionsSelected)}-${JSON.stringify(comboItems)}`;

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.cartId === cartId);
      if (existingItem) {
        return prevCart.map((item) =>
          item.cartId === cartId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Calcular precio de oferta incluyendo el ajuste de opciones extras y el descuento
        const discount = product.discount || 0;
        const finalPrice = getProductPriceWithExtras(product, optionsSelected);

        return [
          ...prevCart,
          {
            cartId,
            id: product.id,
            name: product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            basePrice: product.price,
            price: finalPrice, // Precio unitario final cobrado
            discount,
            quantity,
            category: product.category,
            optionsSelected,
            comboItems
          }
        ];
      }
    });
  };

  const removeFromCart = (cartId) => {
    setCart((prevCart) => prevCart.filter((item) => item.cartId !== cartId));
  };

  const updateQuantity = (cartId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(cartId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.cartId === cartId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setCouponCode("");
    setCouponDiscount(0);
    setShippingCost(0);
    setShippingDistance(0);
    setTableNumber("");
    setCustomerCoords(null);
  };

  const applyCoupon = (code) => {
    const cleanCode = code.trim().toUpperCase();
    const coupons = businessConfig.discounts?.coupons || {};
    if (coupons[cleanCode]) {
      setCouponCode(cleanCode);
      setCouponDiscount(coupons[cleanCode]);
      return { success: true, discount: coupons[cleanCode] };
    }
    return { success: false, message: "Cupón inválido" };
  };

  const removeCoupon = () => {
    setCouponCode("");
    setCouponDiscount(0);
  };

  // Cálculos de Totales
  const getTotals = () => {
    // 1. Subtotal de productos en el carrito (ya incluye descuentos individuales)
    const itemsSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

    // 2. Descuento de Cupón (aplica sobre el subtotal de productos)
    const couponDiscountAmount = itemsSubtotal * (couponDiscount / 100);

    // 3. Descuento Automático Progresivo
    // Se evalúa en base al subtotal de productos menos el descuento por cupón
    const subtotalAfterCoupon = itemsSubtotal - couponDiscountAmount;
    let autoDiscountPercent = 0;
    const rules = businessConfig.discounts?.autoDiscounts || [];
    rules.forEach((rule) => {
      if (subtotalAfterCoupon >= rule.minAmount && rule.discountPercent > autoDiscountPercent) {
        autoDiscountPercent = rule.discountPercent;
      }
    });
    const autoDiscountAmount = subtotalAfterCoupon * (autoDiscountPercent / 100);

    const totalDiscountAmount = couponDiscountAmount + autoDiscountAmount;
    const subtotalWithDiscounts = itemsSubtotal - totalDiscountAmount;

    // 4. Impuestos
    let taxAmount = 0;
    const taxRate = businessConfig.tax?.taxRate || 0;
    const taxEnabled = businessConfig.tax?.taxEnabled || false;
    const taxIncluded = businessConfig.tax?.taxIncluded || false;

    if (taxEnabled) {
      if (taxIncluded) {
        // El impuesto ya está en el precio final, se calcula la parte proporcional
        taxAmount = subtotalWithDiscounts - (subtotalWithDiscounts / (1 + taxRate / 100));
      } else {
        // El impuesto se añade al total
        taxAmount = subtotalWithDiscounts * (taxRate / 100);
      }
    }

    // 5. Total
    const subtotalBeforeShipping = taxIncluded 
      ? subtotalWithDiscounts 
      : subtotalWithDiscounts + taxAmount;
      
    // En delivery sumamos los costes de envío
    const finalTotal = serviceMode === "delivery" 
      ? subtotalBeforeShipping + shippingCost 
      : subtotalBeforeShipping;

    return {
      subtotal: itemsSubtotal,
      couponDiscountAmount,
      autoDiscountPercent,
      autoDiscountAmount,
      totalDiscount: totalDiscountAmount,
      subtotalWithDiscounts,
      taxAmount,
      shippingCost: serviceMode === "delivery" ? shippingCost : 0,
      total: Math.max(0, finalTotal)
    };
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        applyCoupon,
        removeCoupon,
        couponCode,
        couponDiscount,
        shippingCost,
        setShippingCost,
        shippingDistance,
        setShippingDistance,
        serviceMode,
        setServiceMode,
        tableNumber,
        setTableNumber,
        customerName,
        setCustomerName,
        customerPhone,
        setCustomerPhone,
        customerAddress,
        setCustomerAddress,
        customerCoords,
        setCustomerCoords,
        businessConfig,
        getTotals
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
