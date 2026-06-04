import { db, auth } from "../firebase/config";
import { doc, setDoc, writeBatch } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";

export const seedDatabase = async () => {
  const status = [];
  
  try {
    // 1. Sembrar Configuración del Negocio
    const configRef = doc(db, "config", "settings");
    await setDoc(configRef, {
      name: "Pizza Hub & Co.",
      whatsappNumber: "+51999999999",
      address: "Av. del Sabor 789, Ciudad Pizza",
      currency: "USD",
      logoUrl: "/pwa-192x192.png",
      vCardEnabled: true,
      maintenanceMessage: "", // vacío = abierto
      tax: {
        taxEnabled: true,
        taxRate: 18,
        taxIncluded: true,
        taxName: "IGV"
      },
      discounts: {
        coupons: {
          "PIZZALOVE": 20,
          "WELCOME10": 10
        },
        autoDiscounts: [
          { minAmount: 50, discountPercent: 5 },
          { minAmount: 100, discountPercent: 10 },
          { minAmount: 150, discountPercent: 15 }
        ]
      },
      shipping: {
        shippingMode: "distance",
        shippingCostPerKm: 1.5,
        businessLocation: { lat: -12.046374, lng: -77.031002 }, // Lima, Perú
        shippingZones: []
      },
      serviceModes: {
        delivery: true,
        pickup: true,
        dineIn: true,
        tableNumbers: 20,
        tableLabel: "Mesa"
      }
    });
    status.push("Configuración sembrada correctamente.");

    // 1.5. Sembrar Categorías por Defecto
    const defaultCategories = [
      { id: "pizzas", name: "Pizzas" },
      { id: "combos", name: "Combos" },
      { id: "bebidas", name: "Bebidas" },
      { id: "entradas", name: "Entradas" }
    ];
    for (const cat of defaultCategories) {
      await setDoc(doc(db, "categories", cat.id), cat);
    }
    status.push("Categorías por defecto sembradas.");

    // 2. Sembrar Productos del Menú
    const products = [
      {
        id: "la-trufada-real",
        name: "La Trufada Real",
        description: "Base bianca, mozzarella fior di latte, crema de trufas negras silvestres, champiñones portobello frescos y un toque de aceite de trufa premium.",
        price: 22.00,
        discount: 10, // 10% descuento individual
        category: "pizzas",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
        options: {
          Tamaño: ["Mediana", "Familiar (+ $5.00)"],
          Masa: ["Tradicional", "Borde de Queso (+ $3.00)", "Masa Fina"]
        }
      },
      {
        id: "margherita-clasica",
        name: "Margherita Clásica",
        description: "Salsa de tomate San Marzano DOP, mozzarella fior di latte fresca, hojas de albahaca recién cortadas y un chorrito de aceite de oliva virgen extra.",
        price: 14.00,
        discount: 0,
        category: "pizzas",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&w=600&q=80",
        options: {
          Tamaño: ["Mediana", "Familiar (+ $4.00)"],
          Masa: ["Tradicional", "Masa Fina"]
        }
      },
      {
        id: "diavola-picante",
        name: "Diavola Picante",
        description: "Salsa de tomate, mozzarella fior di latte, abundante salami picante calabrés picadito y hojas de albahaca fresca.",
        price: 16.00,
        discount: 0,
        category: "pizzas",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80",
        options: {
          Tamaño: ["Mediana", "Familiar (+ $5.00)"],
          Masa: ["Tradicional", "Masa Fina", "Borde de Queso (+ $3.00)"]
        }
      },
      {
        id: "cuatro-quesos",
        name: "Cuatro Quesos Premium",
        description: "Una mezcla perfecta de queso mozzarella, gorgonzola intenso, parmesano reggiano rallado y provolone fundente.",
        price: 18.00,
        discount: 0,
        category: "pizzas",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=600&q=80",
        options: {
          Tamaño: ["Mediana", "Familiar (+ $5.00)"]
        }
      },
      {
        id: "combo-familiar",
        name: "Combo Familiar Hub",
        description: "Llevate 2 Pizzas Medianas a elegir (Margherita o Diavola) + 1 Gaseosa 1.5L + 1 Porción de Pan al ajo crujiente.",
        price: 32.00,
        discount: 0,
        category: "combos",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=600&q=80",
        comboItems: [
          "Pizza 1 (Margherita / Diavola)",
          "Pizza 2 (Margherita / Diavola)",
          "Bebida (Coca-Cola / Inca Kola)"
        ]
      },
      {
        id: "duo-margherita",
        name: "Dúo Margherita",
        description: "2 Pizzas Margherita Medianas + 2 bebidas de lata a elección por un precio especial.",
        price: 24.00,
        discount: 5, // 5% de descuento adicional
        category: "combos",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=600&q=80",
        comboItems: [
          "Bebida 1 (Lata)",
          "Bebida 2 (Lata)"
        ]
      },
      {
        id: "coca-cola-15",
        name: "Coca-Cola 1.5L",
        description: "Gaseosa helada tamaño familiar para compartir con tus pizzas.",
        price: 3.50,
        discount: 0,
        category: "bebidas",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80"
      },
      {
        id: "cerveza-ipa",
        name: "Cerveza Artesanal IPA",
        description: "Cerveza artesanal de lúpulo intenso, maridaje perfecto para pizzas con personalidad.",
        price: 5.00,
        discount: 0,
        category: "bebidas",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&w=600&q=80"
      },
      {
        id: "agua-mineral",
        name: "Agua Mineral sin Gas",
        description: "Agua purificada de manantial helada.",
        price: 2.00,
        discount: 0,
        category: "bebidas",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1608885898957-a599fb18ec3d?auto=format&fit=crop&w=600&q=80"
      }
    ];

    const batch = writeBatch(db);
    products.forEach((prod) => {
      const prodRef = doc(db, "products", prod.id);
      batch.set(prodRef, prod);
    });
    await batch.commit();
    status.push(`Menú sembrado con ${products.length} productos.`);

    // 3. Crear usuarios de prueba (Admin, Cajero, Cocinero)
    const testAccounts = [
      { email: "admin@posvcard.com", password: "admin123", role: "admin" },
      { email: "cajero@posvcard.com", password: "cajero123", role: "cashier" },
      { email: "cocinero@posvcard.com", password: "cocinero123", role: "cook" }
    ];

    for (const acc of testAccounts) {
      try {
        // Intentar registrar el usuario en Auth
        const cred = await createUserWithEmailAndPassword(auth, acc.email, acc.password);
        const uid = cred.user.uid;
        
        // Crear documento de rol en Firestore
        await setDoc(doc(db, "users", uid), {
          email: acc.email,
          role: acc.role
        });
        
        status.push(`Usuario creado: ${acc.email} (${acc.role})`);
      } catch (authErr) {
        if (authErr.code === "auth/email-already-in-use") {
          // El usuario ya existe en Auth, pero nos aseguramos de que su rol esté en Firestore
          status.push(`Usuario ${acc.email} ya existe. Sincronizando rol en Firestore...`);
        } else if (authErr.code === "auth/configuration-not-found") {
          console.error(`Error de configuración en Firebase:`, authErr);
          status.push(`❌ Error en ${acc.email}: El proveedor de correo/contraseña no está activo en Firebase.`);
          status.push(`👉 SOLUCIÓN: Entra a tu Firebase Console -> Authentication -> Sign-in method y HABILITA "Email/Password".`);
        } else {
          console.error(`Error al registrar ${acc.email}:`, authErr);
          status.push(`Error en ${acc.email}: ${authErr.message}`);
        }
      }
    }
    
    // Hacer deslogueo en caso de que haya quedado una sesión abierta de la última creación
    await signOut(auth);

    return { success: true, logs: status };
  } catch (error) {
    console.error("Error en seedDatabase:", error);
    return { success: false, error: error.message, logs: status };
  }
};
