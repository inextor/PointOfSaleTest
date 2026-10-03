// Replica EXACTA de la orden 179047 (sucursal CAMINO 6, IVA 8% fronterizo):
// los mismos 4 articulos Comex, las mismas cantidades (1 c/u) y los mismos
// importes con IVA incluido que la orden real, cerrada a credito (forma 99)
// y con intento de CFDI al 8% tal cual.
//
// La orden original: subtotal 1136.57 + IVA 90.94 = 1227.50, price_type 3
// (CLIENTES CREDITO), serie CMNO, billing_data 3, receptor GEODE SECO
// (GSE980910QF5, 601, G03, CP 21430). El renglon 1 trae un descuadre de
// 1 centavo (947.69 + 75.82 = 1023.51 vs total 1023.50).
//
// Resultado esperado del intento de CFDI:
//   - Con credenciales PAC reales (produccion): timbra; el test verifica
//     UUID, 4 conceptos y totales cercanos a los de la orden.
//   - Con credenciales PAC demo (este ambiente): el PAC rechaza la tasa 8%
//     de franja fronteriza (CFDI40999: el RFC emisor demo no tiene permitido
//     timbrar esos impuestos); el test lo afirma como resultado documentado.
// Cualquier otro error (serie, matematicas CFDI40180, etc.) SI falla.
//
// La sucursal se RESUELVE: se prefiere la 6 (CAMINO) y, si no esta al 8%
// DESGLOSADA, se usa otra ACTIVA al 8% DESGLOSADA. Los articulos se resuelven
// por nombre exacto (en POS_comex son los reales 8854/700/777/838) y solo se
// crean si no existen. El receptor y la serie se pueden ajustar en la pagina
// sin editar el archivo.
const factura179047Config = {
	sourceOrderId: 179047,
	// Sucursal de la orden 179047: CAMINO, tax_percent 8, modo DESGLOSADA.
	storeId: 6,
	taxPercent: 8,
	priceTypeId: 3,
	currencyId: 'MXN',
	// Serie generica 'A': el PAC demo no tiene dada de alta la serie CMNO
	// de la orden (FI778) y rechaza antes de llegar a validar la tasa 8%.
	// Para correr contra produccion (credenciales PAC reales), cambiar la
	// serie a CMNO en la pagina.
	serie: 'A',
	note: 'P.O. 26101-31NM COLOR L4-09 EUCALIPTO',
	// billing_data de la sucursal (con credenciales del PAC). Una fila nueva
	// de billing_data no esta autorizada ante el PAC.
	preferredBillingDataId: 3,
	billingDataRfc: 'ROLH92062346A',
	receiver: {
		razonSocial: 'GEODE SECO',
		email: 'tania.osorio@secoprecision.com',
		rfc: 'GSE980910QF5',
		domicilioFiscal: '21430',
		regimenFiscal: '601',
		regimenCapital: '601',
		usoCfdi: 'G03',
		formaPago: '99'
	},
	clientCreditDays: 30,
	clientCreditLimit: 40000,
	// Valores tomados verbatim de la orden 179047 (precio con IVA incluido =
	// original_unitary_price; el resto son los importes guardados por el sistema).
	lines: [
		{
			sourceItemId: 8854,
			name: 'VINIMEX TOTAL ULTRALAVABLE MATE V3 4L',
			code: '0475440',
			claveSat: '31211506',
			unit: 'H87',
			qty: 1,
			original: 1023.5,
			unitary: 947.69,
			subtotal: 947.69,
			tax: 75.82,
			total: 1023.5
		},
		{
			sourceItemId: 700,
			name: "COMEX FELPA MICROFIBRA LISA 3/8''",
			code: 'H963056',
			claveSat: '31211906',
			unit: 'H87',
			qty: 1,
			original: 75,
			unitary: 69.44,
			subtotal: 69.44,
			tax: 5.56,
			total: 75
		},
		{
			sourceItemId: 777,
			name: 'COMEX MANERAL AZUL EXTRAREFORZADO',
			code: 'H024274',
			claveSat: '31211906',
			unit: 'H87',
			qty: 1,
			original: 95,
			unitary: 87.96,
			subtotal: 87.96,
			tax: 7.04,
			total: 95
		},
		{
			sourceItemId: 838,
			name: 'COMEX BROCHA ULTRA 2',
			code: 'H023898',
			claveSat: '31211904',
			unit: 'H87',
			qty: 1,
			original: 34,
			unitary: 31.48,
			subtotal: 31.48,
			tax: 2.52,
			total: 34
		}
	],
	// Totales de la orden 179047.
	orderSubtotal: 1136.57,
	orderTax: 90.94,
	orderTotal: 1227.5
};

// Si la pagina trae inputs de configuracion (factura_179047.html), se leen al
// momento de correr; si no, se usan los valores de arriba.
function f179ApplyPageConfig() {
	if (typeof document === 'undefined' || !document.getElementById) return { facturar: true, applyRounding: false };
	if (!document.getElementById('f179-billing')) return { facturar: true, applyRounding: false };
	const get = function(id) {
		const el = document.getElementById(id);
		return el ? el.value.trim() : '';
	};
	const cfg = factura179047Config;
	cfg.preferredBillingDataId = Number(get('f179-billing')) || cfg.preferredBillingDataId;
	cfg.serie = get('f179-serie') || cfg.serie;
	const rc = cfg.receiver;
	rc.razonSocial = get('f179-razon') || rc.razonSocial;
	rc.email = get('f179-email') || rc.email;
	rc.rfc = get('f179-rfc') || rc.rfc;
	rc.domicilioFiscal = get('f179-cp') || rc.domicilioFiscal;
	rc.regimenFiscal = get('f179-regimen') || rc.regimenFiscal;
	rc.regimenCapital = get('f179-capital') || rc.regimenCapital;
	rc.usoCfdi = get('f179-uso') || rc.usoCfdi;
	rc.formaPago = get('f179-forma') || rc.formaPago;
	return {
		facturar: document.getElementById('f179-facturar').checked,
		applyRounding: document.getElementById('f179-rounding').checked
	};
}

function f179Round2(n) {
	return Math.round(Number(n) * 100) / 100;
}

function f179SameMoney(actual, expected) {
	return f179Round2(actual) === f179Round2(expected);
}

async function f179GetStore(storeId, bearer) {
	const response = await apiRequest('/store.php?id=' + encodeURIComponent(storeId), { bearer });
	return response.store || response;
}

function f179StoreMatches(store) {
	return !!store
		&& Number(store.id) > 0
		&& Number(store.tax_percent) === factura179047Config.taxPercent
		&& store.modo_facturacion === 'DESGLOSADA';
}

// Resuelve la sucursal al 8%: se prefiere la 6 (CAMINO, la de la orden) y,
// solo si no esta disponible al 8% DESGLOSADA, se usa otra ACTIVA igual.
async function f179ResolveStore(bearer) {
	const cfg = factura179047Config;

	try {
		const store = await f179GetStore(cfg.storeId, bearer);
		if (f179StoreMatches(store)) return store;
	}
	catch (error) {
		console.log('f179ResolveStore: sucursal ' + cfg.storeId + ' no disponible (' + error.message + '), buscando otra al 8%');
	}

	const list = await apiRequest('/store.php?limit=-1', { bearer });
	const rows = (list.data || list.result || []).map(function(r) { return r.store || r; });
	const found = rows.find(function(r) {
		return r && r.status === 'ACTIVE' && f179StoreMatches(r);
	});

	if (!found) {
		throw new Error('No hay sucursal ACTIVA al 8% DESGLOSADA (la orden 179047 es de CAMINO 6)');
	}

	console.log('f179ResolveStore: usando sucursal ' + found.id + ' (' + (found.name || '?') + ') en vez de la 6');
	return found;
}

// Reutiliza un billing_data autorizado: el default de la sucursal, el preferido
// o cualquiera con credenciales PAC. Nunca se crea uno nuevo (no tendria
// credenciales PAC).
async function f179ResolveBillingDataId(store, bearer) {
	const cfg = factura179047Config;
	const candidates = [];

	if (store && store.default_billing_data_id) {
		candidates.push(Number(store.default_billing_data_id));
	}
	candidates.push(Number(cfg.preferredBillingDataId));

	for (const candidate of candidates) {
		if (!candidate) continue;
		try {
			const response = await apiRequest('/billing_data.php?id=' + encodeURIComponent(candidate), { bearer });
			const row = response.billing_data || response;
			if (row && row.id) return Number(row.id);
		}
		catch (error) {
			// se intenta el siguiente candidato
		}
	}

	const list = await apiRequest('/billing_data.php?limit=-1', { bearer });
	const rows = (list.data || list.result || [])
		.map(function(r) { return r.billing_data || r; })
		.filter(function(r) { return r && r.id; });

	if (!rows.length) {
		throw new Error('Sin billing_data en destino: tabla vacia, imposible timbrar');
	}

	const withPac = rows.find(function(r) { return r.usuario && r.password; });
	const pick = withPac || rows.find(function(r) { return r.rfc === cfg.billingDataRfc; }) || rows[0];
	console.log('f179ResolveBillingDataId: usando billing_data ' + pick.id + ' (' + (pick.rfc || '?') + ')');
	return Number(pick.id);
}

// El price_type_id de origen puede no existir en destino (FK order_ibfk_10).
// Se verifica: el de la orden si existe, si no el 1, si no el primero que haya.
async function f179ResolvePriceTypeId(bearer, preferredId) {
	const cands = [];
	if (preferredId) cands.push(Number(preferredId));
	if (Number(preferredId) !== 1) cands.push(1);

	for (const candidate of cands) {
		if (!candidate) continue;
		try {
			const r = await apiRequest('/price_type.php?id=' + candidate, { bearer });
			if ((r.price_type || r).id) return Number((r.price_type || r).id);
		}
		catch (error) {}
	}

	const list = await apiRequest('/price_type.php?limit=-1', { bearer });
	const rows = (list.data || list.result || [])
		.map(function(r) { return r.price_type || r; })
		.filter(function(r) { return r && r.id; });

	if (!rows.length) {
		throw new Error('Sin price_type en destino: tabla vacia, imposible crear orden');
	}

	console.log('f179ResolvePriceTypeId: ' + preferredId + ' no existe, usando ' + rows[0].id);
	return Number(rows[0].id);
}

async function f179StockOf(itemId, storeId, bearer) {
	const response = await apiRequest(
		'/stock_record_info.php?item_id=' + encodeURIComponent(itemId)
		+ '&store_id=' + encodeURIComponent(storeId)
		+ '&is_current=1',
		{ bearer }
	);
	const rows = response.data || [];
	return rows.length && rows[0].stock_record ? Number(rows[0].stock_record.qty) : 0;
}

async function f179SetStock(itemId, storeId, qty, bearer, comment) {
	await apiRequest('/updates/stock_adjust.php', {
		method: 'POST',
		bearer,
		body: [{
			comment: comment || 'POSTest factura 179047',
			item_id: itemId,
			qty: qty,
			skip_merma: true,
			store_id: storeId
		}]
	});
}

// Precio explicito como en quote_replica_12349.js, para que el articulo sea
// vendible y pagable tambien desde el POS con el precio de la orden.
// Idempotente: se reutiliza la fila existente con ese mismo precio.
async function f179EnsurePrice(bearer, itemId, price, priceTypeId) {
	const search = await apiRequest(
		'/price.php?item_id=' + encodeURIComponent(itemId)
		+ '&price_list_id=1&price_type_id=' + priceTypeId,
		{ bearer }
	);
	const rows = (search.data || search.result || []).map(function(r) { return r.price || r; });
	const existing = rows.find(function(r) {
		return r && r.price !== undefined && f179SameMoney(r.price, price);
	});

	if (existing) return existing;

	return apiRequest('/price.php', {
		method: 'POST',
		bearer,
		body: {
			currency_id: factura179047Config.currencyId,
			item_id: itemId,
			percent: 0,
			price: price,
			price_list_id: 1,
			price_type_id: priceTypeId,
			tax_included: 'YES'
		}
	});
}

// Resuelve (o crea por nombre exacto) los articulos con los mismos campos que
// los articulos reales de la orden: applicable_tax DEFAULT, tax_percent 0, H87.
// En POS_comex los encuentra: son los reales 8854/700/777/838.
async function f179ResolveItems(bearer, priceTypeId) {
	const resolved = [];

	for (const line of factura179047Config.lines) {
		const item = await getOrCreateItem(bearer, {
			applicable_tax: 'DEFAULT',
			availability_type: 'ON_STOCK',
			clave_sat: line.claveSat,
			code: line.code,
			currency_id: factura179047Config.currencyId,
			measurement_unit: 'Pieza',
			name: line.name,
			note_required: 'NO',
			on_sale: 'NO',
			reference_price: line.unitary,
			return_action: 'RETURN_TO_STOCK',
			status: 'ACTIVE',
			tax_percent: 0,
			unidad_medida_sat_id: line.unit
		});

		await f179EnsurePrice(bearer, item.id, line.total, priceTypeId);

		resolved.push({ id: item.id, item: item, line: line });
	}

	return resolved;
}

// Cliente a credito como el de la orden (30 dias, limite 40000): sin limite,
// closeOrder sin pago falla. Sin email (el backend rechaza crearlo) y sin
// username; el email del receptor (GEODE SECO) solo viaja en el CFDI.
async function f179CreateClient(storeId, priceTypeId, bearer) {
	const cfg = factura179047Config;
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer,
		body: {
			creation_store_id: storeId,
			credit_days: cfg.clientCreditDays,
			credit_limit: cfg.clientCreditLimit,
			name: uniqueName('POSTest Factura 179047'),
			phone: '5214350',
			price_type_id: priceTypeId,
			status: 'ACTIVE',
			type: 'CLIENT'
		}
	});

	if (!client.id) {
		throw new Error('Client creation did not return an id: ' + JSON.stringify(client));
	}

	return client;
}

// POST order_info.php con los valores verbatim de la orden 179047 (sin
// calcular): OrderUtils::applyPrice rama YES respeta los valores completos.
async function f179CreateOrder(client, resolvedItems, store, priceTypeId, bearer, cashierUserId) {
	const cfg = factura179047Config;
	const group = Date.now();

	const orderInfo = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer,
		body: {
			order: {
				billing_data_id: store.default_billing_data_id || cfg.preferredBillingDataId,
				cashier_user_id: cashierUserId,
				client_name: 'POSTest Factura 179047 replica ' + cfg.sourceOrderId,
				client_user_id: client.id,
				currency_id: cfg.currencyId,
				price_type_id: priceTypeId,
				service_type: 'QUICK_SALE',
				status: 'PENDING',
				store_id: store.id,
				sync_id: store.id + '-' + Date.now(),
				subtotal: cfg.orderSubtotal,
				tax: cfg.orderTax,
				tax_percent: cfg.taxPercent,
				total: cfg.orderTotal,
				discount: 0,
				note: cfg.note,
				facturacion_code: '',
				sat_serie: cfg.serie,
				sat_forma_pago: cfg.receiver.formaPago
			},
			items: resolvedItems.map(function(entry, n) {
				const line = entry.line;
				return {
					order_item: {
						item_id: entry.id,
						delivery_status: 'PENDING',
						stock_status: 'IN_STOCK',
						tax_included: 'YES',
						delivered_qty: 0,
						status: 'ACTIVE',
						commanda_status: 'NOT_DISPLAYED',
						item_group: group + n,
						return_required: 'NO',
						is_item_extra: 'NO',
						is_free_of_charge: 'NO',
						note: '',
						qty: line.qty,
						item_option_qty: 1,
						paid_qty: 0,
						original_unitary_price: line.original,
						unitary_price: line.unitary,
						unitary_price_meta: line.original,
						subtotal: line.subtotal,
						discount: 0,
						discount_percent: 0,
						tax: line.tax,
						total: line.total,
						type: 'NORMAL',
						preparation_status: 'PENDING'
					}
				};
			})
		}
	});

	if (!orderInfo.order || !orderInfo.order.id) {
		throw new Error('Order creation did not return order.id: ' + JSON.stringify(orderInfo).slice(0, 300));
	}

	return orderInfo;
}

// Cierre a credito (sin pago), igual que la orden original: CLOSED con
// PARTIALLY_PAID y amount_paid 0. Requiere el limite del cliente.
async function f179CloseOnCredit(orderId, bearer) {
	await apiRequest('/updates.php', {
		method: 'POST',
		bearer,
		body: { method: 'closeOrder', order_id: orderId }
	});

	return apiRequest('/order_info.php?id=' + encodeURIComponent(orderId), { bearer });
}

// Deja la orden y el CFDI a proposito para poder revisarlos en la interfaz
// (misma convencion que las pruebas de facturacion recientes).
async function f179Facturar(orderId, store, billingDataId, bearer, applyRounding) {
	const cfg = factura179047Config;
	const rc = cfg.receiver;

	await apiRequest('/updates/datos_facturacion.php', {
		method: 'POST',
		bearer,
		body: {
			id: orderId,
			billing_data_id: billingDataId,
			sat_codigo_postal: store.zipcode || '21470',
			sat_domicilio_fiscal_receptor: rc.domicilioFiscal,
			sat_forma_pago: rc.formaPago,
			sat_razon_social: rc.razonSocial,
			sat_receptor_email: rc.email,
			sat_receptor_rfc: rc.rfc,
			sat_regimen_capital_receptor: rc.regimenCapital,
			sat_regimen_fiscal_receptor: rc.regimenFiscal,
			sat_serie: cfg.serie,
			sat_uso_cfdi: rc.usoCfdi
		}
	});

	const order = (await apiRequest('/order_info.php?id=' + encodeURIComponent(orderId), { bearer })).order;

	const facturada = await apiRequest('/facturacion_request.php', {
		method: 'POST',
		bearer,
		body: {
			facturacion_code: order.facturacion_code,
			razon_social: rc.razonSocial,
			email: rc.email,
			rfc: rc.rfc,
			domicilio_fiscal: rc.domicilioFiscal,
			forma_de_pago: rc.formaPago,
			sat_serie: cfg.serie,
			regimen_fiscal: rc.regimenFiscal,
			regimen_capital: rc.regimenCapital,
			uso_cfdi: rc.usoCfdi,
			version: '4.0',
			billing_data_id: billingDataId,
			apply_rounding_discount_adjustment: !!applyRounding
		}
	});

	const result = facturada.order || facturada;

	if (!result.sat_factura_id) {
		throw new Error('Factura was not created: ' + JSON.stringify(facturada).slice(0, 300));
	}

	return apiRequest('/sat_factura.php?id=' + encodeURIComponent(result.sat_factura_id), { bearer });
}

async function f179FetchXmlText(bearer, attachmentId) {
	const response = await fetch(endpoint() + '/attachment.php?id=' + encodeURIComponent(attachmentId), {
		headers: { Authorization: 'Bearer ' + bearer }
	});

	if (!response.ok) {
		throw new Error('XML fetch failed with HTTP ' + response.status);
	}

	return response.text();
}

// Primer atributo de la etiqueta de apertura indicada (con prefijo, p.ej.
// 'cfdi:Comprobante'). Se limita a la apertura para no confundir Total con
// TotalImpuestosTrasladados de los nodos hijos.
function f179XmlAttr(xml, tagName, attrName) {
	const root = xml.match(new RegExp('<' + tagName + '\\b[^>]*>'));
	if (!root) return null;
	const match = root[0].match(new RegExp('\\b' + attrName + '="([^"]*)"'));
	return match ? match[1] : null;
}

function f179ConceptoAttr(xml, index, attrName) {
	const tags = xml.match(new RegExp('<cfdi:Concepto\\b[^>]*>', 'g')) || [];
	if (!tags[index]) return null;
	const match = tags[index].match(new RegExp('\\b' + attrName + '="([^"]*)"'));
	return match ? match[1] : null;
}

function f179TrasladoAttr(xml, index, attrName) {
	const tags = xml.match(new RegExp('<cfdi:Traslado\\b[^>]*>', 'g')) || [];
	if (!tags[index]) return null;
	const match = tags[index].match(new RegExp('\\b' + attrName + '="([^"]*)"'));
	return match ? match[1] : null;
}

QUnit.module('Factura 179047 al 8%');

QUnit.test('renglones de la orden 179047 suman 1136.57 + 90.94 = 1227.50', function(assert) {
	assert.expect(7);

	const cfg = factura179047Config;
	let subtotal = 0;
	let tax = 0;
	let total = 0;

	cfg.lines.forEach(function(line, index) {
		subtotal = f179Round2(subtotal + line.subtotal);
		tax = f179Round2(tax + line.tax);
		total = f179Round2(total + line.total);
		if (index === 0) {
			// La orden real trae este descuadre de 1 centavo en el renglon 1.
			assert.equal(
				f179Round2(line.subtotal + line.tax),
				1023.51,
				'renglon 1 con descuadre documentado (947.69 + 75.82 = 1023.51 vs total 1023.50)'
			);
		}
		else {
			assert.equal(
				f179Round2(line.subtotal + line.tax),
				f179Round2(line.total),
				'renglon ' + (index + 1) + ' autoconsistente (' + line.subtotal + ' + ' + line.tax + ' = ' + line.total + ')'
			);
		}
	});

	assert.equal(subtotal, cfg.orderSubtotal, 'suma de subtotales igual a 1136.57');
	assert.equal(tax, cfg.orderTax, 'suma de IVA igual a 90.94');
	assert.equal(total, cfg.orderTotal, 'suma de totales igual a 1227.50');
});

QUnit.test('replica orden 179047 e intenta CFDI al 8% forma 99', async function(assert) {
	assert.timeout(300000);

	const cfg = factura179047Config;
	const page = f179ApplyPageConfig();
	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const store = await f179ResolveStore(session.bearer);
	assert.ok(store.id, 'sucursal resuelta ' + store.id + ' (' + (store.name || '?') + ')');
	assert.equal(Number(store.tax_percent), cfg.taxPercent, 'sucursal al 8% igual que la orden 179047');
	assert.equal(store.modo_facturacion, 'DESGLOSADA', 'sucursal con facturacion desglosada');

	const billingDataId = await f179ResolveBillingDataId(store, session.bearer);
	assert.ok(billingDataId, 'billing_data autorizado para facturar ' + billingDataId);

	const priceTypeId = await f179ResolvePriceTypeId(session.bearer, cfg.priceTypeId);
	assert.ok(priceTypeId, 'price_type resuelto ' + priceTypeId);

	const resolvedItems = await f179ResolveItems(session.bearer, priceTypeId);
	assert.equal(resolvedItems.length, cfg.lines.length, 'articulos resueltos: ' + cfg.lines.length);

	resolvedItems.forEach(function(entry, index) {
		assert.ok(entry.id, 'articulo renglon ' + (index + 1) + ' id ' + entry.id);
		assert.equal(entry.item.clave_sat, entry.line.claveSat, 'clave_sat renglon ' + (index + 1));
		assert.equal(entry.item.unidad_medida_sat_id, entry.line.unit, 'unidad SAT renglon ' + (index + 1));
		assert.equal(entry.item.applicable_tax, 'DEFAULT', 'applicable_tax renglon ' + (index + 1));
	});

	const originals = {};
	for (const entry of resolvedItems) {
		originals[entry.id] = await f179StockOf(entry.id, store.id, session.bearer);
	}
	for (const entry of resolvedItems) {
		await f179SetStock(entry.id, store.id, originals[entry.id] + entry.line.qty, session.bearer, 'POSTest factura 179047 inicio');
	}

	try {
		const client = await f179CreateClient(store.id, priceTypeId, session.bearer);
		assert.ok(client.id, 'cliente a credito creado ' + client.id);
		assert.equal(Number(client.credit_limit), cfg.clientCreditLimit, 'cliente con limite 40000');

		const created = await f179CreateOrder(client, resolvedItems, store, priceTypeId, session.bearer, session.user.id);
		const orderId = created.order.id;
		assert.ok(orderId, 'orden creada ' + orderId);
		assert.equal(Number(created.order.tax_percent), cfg.taxPercent, 'orden al 8%');
		assert.ok(f179SameMoney(created.order.subtotal, cfg.orderSubtotal), 'orden con subtotal 1136.57');
		assert.ok(f179SameMoney(created.order.tax, cfg.orderTax), 'orden con IVA 90.94');
		assert.ok(f179SameMoney(created.order.total, cfg.orderTotal), 'orden con total 1227.50');

		created.items.forEach(function(itemInfo, index) {
			const oi = itemInfo.order_item;
			const line = cfg.lines[index];
			assert.equal(Number(oi.qty), line.qty, 'renglon ' + (index + 1) + ' cantidad ' + line.qty);
			assert.deepEqual(
				[f179Round2(oi.unitary_price), f179Round2(oi.subtotal), f179Round2(oi.tax), f179Round2(oi.total)],
				[line.unitary, line.subtotal, line.tax, line.total],
				'orden conserva importes exactos renglon ' + (index + 1)
			);
		});

		const closed = await f179CloseOnCredit(orderId, session.bearer);
		assert.equal(closed.order.status, 'CLOSED', 'orden cerrada a credito');
		assert.notEqual(closed.order.paid_status, 'PAID', 'orden no pagada (credito)');
		assert.equal(Number(closed.order.amount_paid), 0, 'orden con amount_paid 0');

		if (!page.facturar) {
			console.log('Factura 179047 -> ORDEN CONSERVADA ' + orderId + ' (timbrado apagado en la pagina)');
			return;
		}

		// Intento de CFDI al 8% con doble resultado honesto: timbra con
		// credenciales PAC reales; con credenciales demo el PAC rechaza la
		// tasa fronteriza (CFDI40999). Cualquier otro error relanza y falla.
		try {
			const satFactura = await f179Facturar(orderId, store, billingDataId, session.bearer, page.applyRounding);
			assert.ok(satFactura.uuid, 'CFDI timbrado al 8% ' + satFactura.uuid);
			assert.equal(satFactura.type, 'NORMAL', 'sat_factura NORMAL');

			const xml = await f179FetchXmlText(session.bearer, satFactura.xml_attachment_id);
			const comprobanteTotal = f179XmlAttr(xml, 'cfdi:Comprobante', 'Total');
			assert.ok(
				Math.abs(Number(comprobanteTotal) - cfg.orderTotal) < 0.02,
				'comprobante con total cercano a 1227.50 (llego ' + comprobanteTotal + ')'
			);
			assert.ok(
				Math.abs(Number(f179XmlAttr(xml, 'cfdi:Comprobante', 'SubTotal')) - cfg.orderSubtotal) < 0.01,
				'comprobante con subtotal cercano a 1136.57'
			);
			assert.ok(
				Math.abs(Number(f179XmlAttr(xml, 'cfdi:Impuestos', 'TotalImpuestosTrasladados')) - cfg.orderTax) < 0.02,
				'impuestos trasladados cercanos a 90.94'
			);
			assert.ok(
				Math.abs(Number(f179TrasladoAttr(xml, 0, 'TasaOCuota')) - 0.08) < 1e-6,
				'traslado a tasa 8%'
			);

			cfg.lines.forEach(function(line, index) {
				assert.ok(
					Math.abs(Number(f179ConceptoAttr(xml, index, 'ValorUnitario')) - line.unitary) < 0.01,
					'concepto ' + (index + 1) + ' unitario ' + line.unitary
				);
				assert.ok(
					Math.abs(Number(f179ConceptoAttr(xml, index, 'Importe')) - line.subtotal) < 0.01,
					'concepto ' + (index + 1) + ' importe ' + line.subtotal
				);
			});

			// Ids visibles para revisar la orden/factura en la interfaz.
			console.log(
				'Factura 179047 -> ORDEN CONSERVADA ' + orderId
				+ ' | FACTURA ' + satFactura.id + ' | UUID ' + satFactura.uuid
				+ ' | Total CFDI ' + comprobanteTotal
			);
		}
		catch (error) {
			const message = String((error && error.message) || error);
			assert.ok(
				message.indexOf('CFDI40999') !== -1,
				'PAC demo rechaza la tasa 8% fronteriza (CFDI40999): ' + message.slice(0, 200)
			);
			console.log(
				'Factura 179047 -> ORDEN CONSERVADA ' + orderId
				+ ' sin timbrar (PAC demo no permite 8%): ' + message.slice(0, 300)
			);
		}
	}
	finally {
		for (const entry of resolvedItems) {
			await f179SetStock(entry.id, store.id, originals[entry.id], session.bearer, 'POSTest factura 179047 restauracion');
		}
	}
});
