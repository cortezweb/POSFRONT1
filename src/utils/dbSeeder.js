import { db, auth } from "../firebase/config";
import { rCol, rDoc, getRestaurantId } from "../firebase/tenant";
import { doc, setDoc, writeBatch, getDocs } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";

export const seedDatabase = async () => {
  const status = [];
  
  try {
    // 0. Limpiar colecciones de productos y categorías existentes
    status.push("Limpiando productos anteriores...");
    const productsSnapshot = await getDocs(rCol("products"));
    if (!productsSnapshot.empty) {
      const prodBatch = writeBatch(db);
      productsSnapshot.forEach((doc) => {
        prodBatch.delete(doc.ref);
      });
      await prodBatch.commit();
      status.push(`Se eliminaron ${productsSnapshot.size} productos anteriores.`);
    }

    status.push("Limpiando categorías anteriores...");
    const categoriesSnapshot = await getDocs(rCol("categories"));
    if (!categoriesSnapshot.empty) {
      const catBatch = writeBatch(db);
      categoriesSnapshot.forEach((doc) => {
        catBatch.delete(doc.ref);
      });
      await catBatch.commit();
      status.push(`Se eliminaron ${categoriesSnapshot.size} categorías anteriores.`);
    }

    // 1. Sembrar Configuración del Negocio
    const configRef = rDoc("config", "settings");
    await setDoc(configRef, {
      name: "GloryChef",
      whatsappNumber: "+59177777777",
      address: "Av. Hernando Siles 456, Sucre, Bolivia",
      currency: "BOB",
      logoUrl: "/pwa-192x192.png",
      vCardEnabled: true,
      maintenanceMessage: "", // vacío = abierto
      tax: {
        taxEnabled: true,
        taxRate: 13, // IVA Bolivia es 13%
        taxIncluded: true,
        taxName: "IVA"
      },
      discounts: {
        coupons: {
          "BOLIVIA50": 10,
          "BIENVENIDO": 5
        },
        autoDiscounts: [
          { minAmount: 150, discountPercent: 5 },
          { minAmount: 300, discountPercent: 10 },
          { minAmount: 500, discountPercent: 15 }
        ]
      },
      shipping: {
        shippingMode: "distance",
        shippingCostPerKm: 2.0, // 2 Bs por km
        businessLocation: { lat: -19.0429, lng: -65.2627 }, // Sucre, Bolivia
        shippingZones: []
      },
      serviceModes: {
        delivery: true,
        pickup: true,
        dineIn: true,
        tableNumbers: 15,
        tableLabel: "Mesa"
      }
    });
    status.push("Configuración comercial boliviana sembrada correctamente.");

    // 1.5. Sembrar Categorías por Defecto
    const defaultCategories = [
      { id: "platos", name: "Platos Principales" },
      { id: "entradas", name: "Sopas & Entradas" },
      { id: "bebidas", name: "Bebidas" },
      { id: "combos", name: "Combos Especiales" }
    ];
    for (const cat of defaultCategories) {
      await setDoc(rDoc("categories", cat.id), cat);
    }
    status.push("Categorías bolivianas sembradas.");

    // 2. Sembrar Productos del Menú (Platos bolivianos)
    const products = [
      {
        id: "pique-macho",
        name: "Pique Macho Tradicional",
        description: "Clásico plato boliviano con abundante carne de res jugosa salteada, salchichas, papas fritas crujientes, rodajas de huevo cocido, cebolla morada, tomate y rodajas de locoto picante.",
        price: 45.00,
        discount: 10, // 10% descuento individual
        category: "platos",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
        options: {
          Tamaño: ["Mediano", "Familiar (+ BOB 20.00)"],
          Picante: ["Con locoto picante", "Sin locoto (Suave)"]
        }
      },
      {
        id: "silpancho-cochala",
        name: "Silpancho Cochabambino",
        description: "Carne de res tierna apanada y frita, servida sobre una cama de arroz graneado caliente, papas doradas en rodajas, un huevo frito encima y abundante salsa criolla (sarza de cebolla, tomate y locoto).",
        price: 30.00,
        discount: 0,
        category: "platos",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
        options: {
          Huevo: ["1 Huevo Frito", "2 Huevos Fritos (+ BOB 2.50)"],
          Arroz: ["Arroz Blanco", "Arroz con Queso (+ BOB 4.00)"]
        }
      },
      {
        id: "sajta-pollo",
        name: "Sajta de Pollo Paceña",
        description: "Delicioso estofado de pollo cocido a fuego lento en una salsa espesa de ají amarillo, servido con tunta rebosada con queso y huevo, papas cocidas y sarza criolla por encima.",
        price: 35.00,
        discount: 0,
        category: "platos",
        stock: 50,
        imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=600&q=80",
        options: {
          Presa: ["Pecho", "Muslo"]
        }
      },
      {
        id: "saltena-carne",
        name: "Salteña de Carne Caliente",
        description: "La empanada boliviana por excelencia. Horneada, de masa dulce y dorada, rellena de carne de res jugosa picada, papas, arvejas, aceitunas y un sabroso caldo condimentado.",
        price: 8.00,
        discount: 0,
        category: "entradas",
        stock: 120,
        imageUrl: "https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=600&q=80",
        options: {
          Variedad: ["Picante", "Medio Picante", "Dulce (Sin picante)"]
        }
      },
      {
        id: "fricase-paceño",
        name: "Fricasé de Cerdo",
        description: "Sopa espesa y picante tradicional de los amaneceres andinos, preparada con carne de cerdo tierna cocida en ají amarillo, maíz mote tierno, chuño entero y sazón tradicional.",
        price: 28.00,
        discount: 0,
        category: "entradas",
        stock: 40,
        imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80",
        options: {
          Porción: ["Normal", "Doble Cerdo (+ BOB 10.00)"]
        }
      },
      {
        id: "mocochinchi-frio",
        name: "Mocochinchi Casero",
        description: "Refresco hervido tradicional boliviano a base de durazno deshidratado (k'isa), sazonado con canela, clavo de olor y azúcar caramelizada, servido muy frío con su durazno entero.",
        price: 6.00,
        discount: 0,
        category: "bebidas",
        stock: 200,
        imageUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80"
      },
      {
        id: "cerveza-pacena",
        name: "Cerveza Paceña 620ml",
        description: "La cerveza insignia de Bolivia, rubia, equilibrada y helada, perfecta para acompañar platos picantes.",
        price: 16.00,
        discount: 0,
        category: "bebidas",
        stock: 100,
        imageUrl: "https://images.unsplash.com/photo-1600788886242-5c96aabe3757?auto=format&fit=crop&w=600&q=80"
      },
      {
        id: "combo-alturas",
        name: "Combo Familiar Alturas",
        description: "Un banquete boliviano: 1 Pique Macho Familiar + 2 Salteñas a elección + 2 Vasos grandes de Mocochinchi frío.",
        price: 85.00,
        discount: 5, // 5% de descuento en el combo
        category: "combos",
        stock: 30,
        imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80",
        comboItems: [
          "Salteña 1 (Picante / Medio / Dulce)",
          "Salteña 2 (Picante / Medio / Dulce)",
          "Bebida 1 (Mocochinchi / Gaseosa)",
          "Bebida 2 (Mocochinchi / Gaseosa)"
        ]
      }
    ];

    const batch = writeBatch(db);
    products.forEach((prod) => {
      const prodRef = rDoc("products", prod.id);
      batch.set(prodRef, prod);
    });
    await batch.commit();
    status.push(`Menú sembrado con ${products.length} platos bolivianos.`);

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
          role: acc.role,
          restaurantId: getRestaurantId()
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
