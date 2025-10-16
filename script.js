// EmailJS 
const EMAILJS_PUBLIC_KEY = "TuhS0Seczz9QwIrV2";
const SERVICE_ID = "service_6gz5wpm";
const TEMPLATE_ID = "template_ibmmboa";

emailjs.init(EMAILJS_PUBLIC_KEY);

// ==============================
// Variables y estado
// ==============================
let carrito = [];
let remitoActual = null;

let paginaActual = 1;
const productosPorPagina = 15;

let productos = [];

// ==============================
// Vinculación con Google Sheets
// (usa tu hoja: 1NNEGWD_SQtV_9jE-kzRhPLzt5QkS-PJyP0CDq1riJ6o)
// Intenta en este orden: "Productos" -> "Hoja 1" -> gid=0
// ==============================
const SHEET_ID = "1NNEGWD_SQtV_9jE-kzRhPLzt5QkS-PJyP0CDq1riJ6o";
const SHEET_URLS = [
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Productos`,
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Hoja%201`,
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`,
];

// ==============================
// Utilidades
// ==============================
const nk = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const getVal = (obj, key) => {
  const found = Object.keys(obj).find((k) => nk(k) === nk(key));
  return found ? obj[found] : "";
};

// Acepta "1.234,56" o "1234.56" o "1,234.56"
const parsePrice = (v) => {
  if (v == null) return 0;
  const s = String(v).replace(/\s/g, "");
  // Si termina con ",xx" se asume decimal con coma y se eliminan puntos de miles
  if (/,(\d{1,2})$/.test(s)) {
    return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  // Caso general: usar punto decimal y sacar comas de miles
  return parseFloat(s.replace(/,/g, "")) || 0;
};

// ==============================
// Cargar productos desde Google Sheets (robusto)
// ==============================
async function cargarProductos() {
  try {
    let csvText = null;
    let lastErr = null;

    for (const url of SHEET_URLS) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const t = await res.text();
        if (t && t.trim().length > 0) {
          console.log("Usando Google Sheets URL:", url);
          csvText = t;
          break;
        }
      } catch (e) {
        console.warn("Fallo con URL:", url, e);
        lastErr = e;
      }
    }

    if (csvText == null) {
      throw lastErr || new Error("No se pudo descargar el CSV desde ninguna URL.");
    }

    // Parseo CSV con Papa Parse
    const data = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    productos = data.data
      .map((p) => ({
        code: getVal(p, "code"),
        description: getVal(p, "description"),
        category: getVal(p, "category"),
        price: parsePrice(getVal(p, "price")),
        stock: parseInt(getVal(p, "stock") || 0, 10),
      }))
      .filter((p) => p.description || p.code);

    console.log("Productos cargados desde Sheets:", productos.length);
  } catch (err) {
    console.error("Error cargando productos desde Google Sheets:", err);
    alert(
      "No se pudieron cargar los productos desde la hoja de Google. " +
        "Verificá que la hoja esté compartida como 'Cualquiera con el enlace - Lector' " +
        "y que los encabezados sean: code, description, category, price, stock."
    );
  }
}

// ==============================
// Mostrar productos por categoría (con paginación)
// ==============================
function mostrarProductos(categoria, pagina = 1) {
  const contenedor = document.getElementById("productos");
  contenedor.innerHTML = "";

  const filtrados = productos.filter((p) => p.category === categoria);

  if (filtrados.length === 0) {
    contenedor.innerHTML = "<p>No hay productos en esta categoría.</p>";
    return;
  }

  // Paginación
  const inicio = (pagina - 1) * productosPorPagina;
  const fin = inicio + productosPorPagina;
  const paginaProductos = filtrados.slice(inicio, fin);

  // Render
  paginaProductos.forEach((prod) => {
    const div = document.createElement("div");
    div.classList.add("producto");

    div.innerHTML = `
      <h3>${prod.description}</h3>
      <p>Código: ${prod.code}</p>
      <p>Precio: $${parsePrice(prod.price).toFixed(2)}</p>
      <!-- Si querés mostrar el stock, descomentá la siguiente línea:
      <p>Stock: <span id="stock-${prod.code}">${Number.isFinite(prod.stock) ? prod.stock : 0}</span></p>
      -->
      <button id="btn-${prod.code}"
        ${prod.stock <= 0 ? "disabled" : ""}
        onclick="agregarAlCarrito('${prod.code}','${prod.description.replace(/'/g, "\\'")}',${parsePrice(prod.price)})">
        Agregar
      </button>
    `;

    contenedor.appendChild(div);
  });

  // Controles de paginación
  const paginacion = document.createElement("div");
  paginacion.classList.add("paginacion");

  if (pagina > 1) {
    const btnPrev = document.createElement("button");
    btnPrev.textContent = "⬅ Anterior";
    btnPrev.onclick = () => mostrarProductos(categoria, pagina - 1);
    paginacion.appendChild(btnPrev);
  }

  if (fin < filtrados.length) {
    const btnNext = document.createElement("button");
    btnNext.textContent = "Siguiente ➡";
    btnNext.onclick = () => mostrarProductos(categoria, pagina + 1);
    paginacion.appendChild(btnNext);
  }

  contenedor.appendChild(paginacion);
}

// ==============================
// Carrito (alta, cambio cantidad, baja)
// ==============================
function agregarAlCarrito(code, description, price) {
  const producto = productos.find((p) => p.code === code);

  // Validación de stock
  if (!producto || producto.stock <= 0) {
    alert("Este producto no tiene stock disponible.");
    return;
  }

  let existente = carrito.find((p) => p.code === code);

  if (existente) {
    if (existente.cantidad < producto.stock) {
      existente.cantidad++;
      existente.subtotal = existente.cantidad * existente.price;
      producto.stock--;
    } else {
      alert(`Solo quedan ${producto.stock} unidades disponibles.`);
    }
  } else {
    carrito.push({
      code,
      description,
      price,
      cantidad: 1,
      subtotal: price,
    });
    producto.stock--;
  }

  // Actualizar stock en pantalla (si mostrás el stock)
  const stockSpan = document.getElementById(`stock-${code}`);
  if (stockSpan) stockSpan.textContent = producto.stock;

  // Desactivar botón si se agotó
  if (producto.stock <= 0) {
    const btn = document.getElementById(`btn-${code}`);
    if (btn) btn.disabled = true;
  }

  renderCarrito();
}

function renderCarrito() {
  const tbody = document.getElementById("carrito-body");
  tbody.innerHTML = "";

  carrito.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.code}</td>
      <td>${item.description}</td>
      <td>
        <input type="number" min="1" value="${item.cantidad}"
               onchange="cambiarCantidad(${index}, this.value)">
      </td>
      <td>$${parsePrice(item.price).toFixed(2)}</td>
      <td>$${item.subtotal.toFixed(2)}</td>
      <td><button onclick="eliminarDelCarrito(${index})">❌</button></td>
    `;
    tbody.appendChild(tr);
  });

  const total = carrito.reduce((sum, i) => sum + i.subtotal, 0);
  document.getElementById("total").textContent = total.toFixed(2);
}

function cambiarCantidad(index, cantidad) {
  cantidad = parseInt(cantidad, 10);
  if (!Number.isFinite(cantidad) || cantidad < 1) cantidad = 1;

  const producto = productos.find((p) => p.code === carrito[index].code);
  if (!producto) return;

  const maxPosible = producto.stock + carrito[index].cantidad;
  if (cantidad > maxPosible) {
    alert(`Stock insuficiente. Solo quedan ${maxPosible} unidades.`);
    cantidad = maxPosible;
  }

  // Ajustar stock disponible en catálogo
  const diferencia = cantidad - carrito[index].cantidad;
  producto.stock -= diferencia;

  carrito[index].cantidad = cantidad;
  carrito[index].subtotal = carrito[index].cantidad * carrito[index].price;

  // Actualizar stock en catálogo (si se muestra)
  const stockSpan = document.getElementById(`stock-${producto.code}`);
  if (stockSpan) stockSpan.textContent = producto.stock;

  if (producto.stock <= 0) {
    const btn = document.getElementById(`btn-${producto.code}`);
    if (btn) btn.disabled = true;
  } else {
    const btn = document.getElementById(`btn-${producto.code}`);
    if (btn) btn.disabled = false;
  }

  renderCarrito();
}

function eliminarDelCarrito(index) {
  const item = carrito[index];
  const producto = productos.find((p) => p.code === item.code);
  if (!producto) return;

  // Devolver stock al catálogo
  producto.stock += item.cantidad;

  const stockSpan = document.getElementById(`stock-${producto.code}`);
  if (stockSpan) stockSpan.textContent = producto.stock;

  // Reactivar botón si volvió stock
  const btn = document.getElementById(`btn-${producto.code}`);
  if (btn) btn.disabled = producto.stock <= 0;

  carrito.splice(index, 1);
  renderCarrito();
}

// ==============================
// Remito / Pedido
// ==============================
function generarNumeroRemito() {
  const fecha = new Date();
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yy = fecha.getFullYear().toString().slice(-2);
  const hh = String(fecha.getHours()).padStart(2, "0");
  const mi = String(fecha.getMinutes()).padStart(2, "0");
  const ss = String(fecha.getSeconds()).padStart(2, "0");
  return `REM-${dd}${mm}${yy}-${hh}${mi}${ss}`;
}

async function finalizarPedido() {
  const cliente = document.getElementById("cliente").value.trim();
  if (!cliente) {
    alert("Ingrese nombre y apellido.");
    return;
  }
  if (carrito.length === 0) {
    alert("El carrito está vacío.");
    return;
  }

  const numeroRemito = generarNumeroRemito();
  const total = carrito.reduce((sum, i) => sum + i.subtotal, 0);

  remitoActual = {
    numero: numeroRemito,
    cliente,
    fecha: new Date().toLocaleString(),
    items: [...carrito],
    total,
  };

  mostrarRemito(remitoActual);

  // Actualizar stock en Google Sheets mediante Apps Script
  try {
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbym93C9owPRg7Qh-f2SO83qfv_cEHoj0J87VUE6B3AKrXgMFkMVihtE5Q-SPrNXksTVDw/exec",
      {
        method: "POST",
        body: JSON.stringify({ items: carrito }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await res.json();

    if (data.success) {
      console.log("Stock actualizado en Sheets:", data.updated);

      // Refrescar el stock en la UI
      data.updated.forEach((u) => {
        const stockSpan = document.getElementById(`stock-${u.code}`);
        if (stockSpan) stockSpan.textContent = u.stock;

        const btn = document.getElementById(`btn-${u.code}`);
        if (btn) btn.disabled = u.stock <= 0;
      });
    } else {
      console.error("Error en respuesta de Apps Script:", data.error);
    }
  } catch (err) {
    console.error("Error actualizando stock:", err);
  }
}

function mostrarRemito(remito) {
  const div = document.getElementById("remito");
  div.innerHTML = `
    <p><strong>Remito N°:</strong> ${remito.numero}</p>
    <p><strong>Cliente:</strong> ${remito.cliente}</p>
    <p><strong>Fecha:</strong> ${remito.fecha}</p>
    <table>
      <thead>
        <tr><th>Código</th><th>Artículo</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr>
      </thead>
      <tbody>
        ${remito.items
          .map(
            (i) =>
              `<tr><td>${i.code}</td><td>${i.description}</td><td>${i.cantidad}</td><td>$${parsePrice(
                i.price
              ).toFixed(2)}</td><td>$${i.subtotal.toFixed(2)}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>
    <h3>Total: $${remito.total.toFixed(2)}</h3>
  `;

  document.getElementById("remito-section").style.display = "block";
}

// ==============================
// Envío por Email (EmailJS)
// ==============================
async function enviarEmail() {
  if (!remitoActual) return alert("No hay remito para enviar.");

  const detalleHTML = remitoActual.items
    .map(
      (i) => `
  <tr>
    <td style="border:1px solid #ddd; padding:6px;">${i.code}</td>
    <td style="border:1px solid #ddd; padding:6px;">${i.description}</td>
    <td style="border:1px solid #ddd; padding:6px; text-align:center;">${i.cantidad}</td>
    <td style="border:1px solid #ddd; padding:6px; text-align:right;">$${parsePrice(i.price).toFixed(2)}</td>
    <td style="border:1px solid #ddd; padding:6px; text-align:right;">$${i.subtotal.toFixed(2)}</td>
  </tr>`
    )
    .join("");

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      numero: remitoActual.numero,
      cliente: remitoActual.cliente,
      fecha: remitoActual.fecha,
      total: remitoActual.total.toFixed(2),
      detalle: detalleHTML,
    });
    alert("Remito enviado con éxito.");
  } catch (err) {
    console.error("Error enviando email:", err);
    alert("Error al enviar el remito.");
  }
}

// ==============================
// Eventos
// ==============================
document.getElementById("finalizar").addEventListener("click", finalizarPedido);
document.getElementById("enviar").addEventListener("click", enviarEmail);

// ==============================
// Inicialización
// ==============================
cargarProductos();
