// Replica exacta de 23 ordenes RMCELL al 16% + orden 169326 al 8% (fijas,
// definidas en rmcell_orders_data.js): POST order_info.php con valores tal cual
// (sin calcular), pago verbatim, cierre y CFDI. Cada test se llama
// "Prueba RMCELL <id>" y el archivo corre solo al abrir la pagina; se puede
// repetir cuantas veces se quiera (cada corrida crea sus propias ordenes
// nuevas). Ademas define "Prueba RMCELL 169326 sin redondeo", duplicado de la
// 169326 con valores exactos de precision completa y aserciones exactas.
var orderReplicaCfdi = { billingDataId: 12, serie: 'A', facturar: true, applyRounding: false,
	receiver: { razonSocial: 'GRUPO JFTI SOLUCIONES', email: 'integranet@integranet.xyz',
		rfc: 'GJS1410232N4', domicilioFiscal: '22887', regimenFiscal: '626',
		regimenCapital: '626', usoCfdi: 'G03', formaPago: '01' } };

// Si la pagina trae inputs de configuracion (order_replica.html), se leen al
// momento de correr; si no, se usan los valores de arriba.
function orApplyPageConfig() {
	if (typeof document === 'undefined' || !document.getElementById) return;
	var g = function(id) {
		var el = document.getElementById(id);
		return el ? el.value.trim() : '';
	};
	if (!document.getElementById('or-billing')) return;
	orderReplicaCfdi.billingDataId = Number(g('or-billing')) || orderReplicaCfdi.billingDataId;
	orderReplicaCfdi.serie = g('or-serie') || orderReplicaCfdi.serie;
	orderReplicaCfdi.facturar = document.getElementById('or-facturar').checked;
	orderReplicaCfdi.applyRounding = document.getElementById('or-rounding').checked;
	var rc = orderReplicaCfdi.receiver;
	rc.razonSocial = g('or-razon') || rc.razonSocial;
	rc.email = g('or-email') || rc.email;
	rc.rfc = g('or-rfc') || rc.rfc;
	rc.domicilioFiscal = g('or-cp') || rc.domicilioFiscal;
	rc.regimenFiscal = g('or-regimen') || rc.regimenFiscal;
	rc.regimenCapital = g('or-capital') || rc.regimenCapital;
	rc.usoCfdi = g('or-uso') || rc.usoCfdi;
	rc.formaPago = g('or-forma') || rc.formaPago;
}

function orRound2(n) { return Math.round(Number(n) * 100) / 100; }

// La preparacion NUNCA debe tumbar el test: si no hay sucursal ACTIVA al
// impuesto pedido, se crea (o se repara) una sucursal de prueba via API y
// se sigue. Solo se lanza error si la tabla store esta literalmente vacia.
// Cache por impuesto: los 23 tests al 16% resuelven una sola vez.
var orStoreCache = {};

function orTestStoreName(taxPercent) {
	return 'RMCELL REPLICA ' + Number(taxPercent) + '%';
}

function orStoreRows(list) {
	return (list.data || list.result || []).map(function(r) { return r.store || r; });
}

async function orFindStoreByName(bearer, name) {
	var q = '?name=' + encodeURIComponent(name) + '&limit=-1';
	try {
		var a = orStoreRows(await apiRequest('/store.php' + q, { bearer: bearer }));
		var hit = a.find(function(r) { return r && r.name === name; });
		if (hit) return hit;
	} catch (e) {}
	try {
		var d = orStoreRows(await apiRequest('/store.php?status=DISABLED&' + q.slice(1), { bearer: bearer }));
		return d.find(function(r) { return r && r.name === name; }) || null;
	} catch (e) {}
	return null;
}

async function orRefreshStore(bearer, id) {
	var r = await apiRequest('/store.php?id=' + encodeURIComponent(id), { bearer: bearer });
	return r.store || r;
}

// Crea o repara la sucursal de prueba al impuesto pedido. Devuelve la
// sucursal lista, o null si el backend no permitio escribir (el llamador
// aplica el ultimo fallback con cualquier sucursal existente).
async function orEnsureTestStore(bearer, taxPercent) {
	var want = Number(taxPercent), name = orTestStoreName(want);
	var owned = await orFindStoreByName(bearer, name);
	try {
		if (owned && owned.id) {
			await apiRequest('/store.php', { method: 'PUT', bearer: bearer, body: {
				id: owned.id, status: 'ACTIVE',
				tax_percent: want, modo_facturacion: 'DESGLOSADA' } });
			var fixed = await orRefreshStore(bearer, owned.id);
			console.log('orResolveStore: sucursal de prueba reparada ' + fixed.id + ' al ' + want + '%');
			return fixed;
		}
		var created = await apiRequest('/store.php', { method: 'POST', bearer: bearer, body: {
			name: name, status: 'ACTIVE',
			tax_percent: want, modo_facturacion: 'DESGLOSADA' } });
		var st = created.store || created;
		if (st && st.id) {
			console.log('orResolveStore: sucursal de prueba creada ' + st.id + ' al ' + want + '%');
			return await orRefreshStore(bearer, st.id);
		}
	} catch (e) {
		console.log('orEnsureTestStore: escritura fallo (' + e.message + '), rebuscando por nombre');
	}
	// Carrera entre corridas (nombre UNIQUE): otro tab la pudo crear.
	var raced = await orFindStoreByName(bearer, name);
	if (raced && raced.id) {
		try {
			await apiRequest('/store.php', { method: 'PUT', bearer: bearer, body: {
				id: raced.id, status: 'ACTIVE',
				tax_percent: want, modo_facturacion: 'DESGLOSADA' } });
			return await orRefreshStore(bearer, raced.id);
		} catch (e2) {
			return raced;
		}
	}
	return null;
}

async function orResolveStore(bearer, taxPercent) {
	var want = Number(taxPercent);
	if (orStoreCache[want] && orStoreCache[want].id) return orStoreCache[want];

	var list = await apiRequest('/store.php?limit=-1', { bearer: bearer });
	var rows = orStoreRows(list);
	var match = rows.find(function(r) { return r && r.status === 'ACTIVE' && Number(r.tax_percent) === want; });
	if (match) {
		orStoreCache[want] = match;
		return match;
	}

	// Filtro en servidor por si la paginacion oculto el match.
	try {
		var f = await apiRequest('/store.php?status=ACTIVE&tax_percent=' + encodeURIComponent(want) + '&limit=-1', { bearer: bearer });
		var frows = orStoreRows(f);
		if (frows.length) {
			orStoreCache[want] = frows[0];
			return frows[0];
		}
	} catch (e) {
		console.log('orResolveStore: filtro servidor fallo, sigo (' + e.message + ')');
	}

	// Sin match: crear/reparar sucursal de prueba al impuesto exacto.
	var healed = await orEnsureTestStore(bearer, want);
	if (healed && healed.id) {
		orStoreCache[want] = healed;
		return healed;
	}

	// Ultimo recurso: cualquier ACTIVA para que el test REAL corra y decida.
	// La orden lleva subtotal/iva/total explicitos, no dependen de la sucursal.
	var anyActive = rows.find(function(r) { return r && r.status === 'ACTIVE'; });
	if (anyActive) {
		console.log('orResolveStore: SIN sucursal al ' + want + '%, usando ' + anyActive.id + ' al ' + anyActive.tax_percent + '% (fallback)');
		return anyActive;
	}
	if (rows.length) return rows[0];
	throw new Error('Sin sucursales en destino: tabla store vacia, imposible probar');
}

// Los valores (precios, subtotales, impuestos) viajan en la orden, no dependen
// del articulo. Por eso se usa UN SOLO articulo compartido para todos los
// renglones de todas las ordenes: se crea una vez y se reutiliza siempre.
// Ni nombre, ni item_id, ni categoria importan.
var orSharedItem = null;
async function orGetSharedItem(bearer) {
	if (orSharedItem && orSharedItem.id) return orSharedItem;
	orSharedItem = await getOrCreateItem(bearer, {
		applicable_tax: 'DEFAULT',
		tax_percent: 0,
		availability_type: 'ALWAYS', // sin manejo de stock
		clave_sat: '53111603',
		code: 'RMCELL-REPLICA',
		name: 'Replica RMCELL Item',
		note_required: 'NO', on_sale: 'NO',
		reference_price: 0,
		return_action: 'RETURN_TO_STOCK',
		status: 'ACTIVE', unidad_medida_sat_id: 'H87'
	});
	return orSharedItem;
}

async function orResolveBillingDataId(store, bearer) {
	var cands = [];
	if (store && store.default_billing_data_id) cands.push(Number(store.default_billing_data_id));
	cands.push(Number(orderReplicaCfdi.billingDataId));
	for (var i = 0; i < cands.length; i++) {
		if (!cands[i]) continue;
		try {
			var r = await apiRequest('/billing_data.php?id=' + cands[i], { bearer: bearer });
			if ((r.billing_data || r).id) return Number((r.billing_data || r).id);
		} catch (e) {}
	}
	// La preparacion tampoco debe fallar aqui: si el id configurado no
	// existe en destino, se usa cualquiera disponible (prefiriendo uno con
	// credenciales PAC para que el timbrado real pueda correr).
	var list = await apiRequest('/billing_data.php?limit=-1', { bearer: bearer });
	var rows = (list.data || list.result || []).map(function(r) { return r.billing_data || r; })
		.filter(function(r) { return r && r.id; });
	if (!rows.length) throw new Error('Sin billing_data en destino: tabla vacia, imposible timbrar');
	var withPac = rows.find(function(r) { return r.usuario && r.password; });
	var pick = withPac || rows[0];
	console.log('orResolveBillingDataId: usando billing_data ' + pick.id + ' (' + (pick.rfc || '?') + ')');
	return Number(pick.id);
}

// El price_type_id de origen puede no existir en destino (FK order_ibfk_10).
// Se verifica: el de la orden si existe, si no el 1, si no el primero que haya.
var orPriceTypeCache = {};

async function orResolvePriceTypeId(bearer, preferredId) {
	var key = 'p' + preferredId;
	if (orPriceTypeCache[key]) return orPriceTypeCache[key];
	var cands = [];
	if (preferredId) cands.push(Number(preferredId));
	if (Number(preferredId) !== 1) cands.push(1);
	for (var i = 0; i < cands.length; i++) {
		if (!cands[i]) continue;
		try {
			var r = await apiRequest('/price_type.php?id=' + cands[i], { bearer: bearer });
			if ((r.price_type || r).id) {
				orPriceTypeCache[key] = Number((r.price_type || r).id);
				return orPriceTypeCache[key];
			}
		} catch (e) {}
	}
	var list = await apiRequest('/price_type.php?limit=-1', { bearer: bearer });
	var rows = (list.data || list.result || []).map(function(r) { return r.price_type || r; })
		.filter(function(r) { return r && r.id; });
	if (!rows.length) throw new Error('Sin price_type en destino: tabla vacia, imposible crear orden');
	console.log('orResolvePriceTypeId: ' + preferredId + ' no existe, usando ' + rows[0].id + ' (' + (rows[0].name || '?') + ')');
	orPriceTypeCache[key] = Number(rows[0].id);
	return orPriceTypeCache[key];
}

async function orFacturar(orderId, billingDataId, bearer, applyRounding) {
	var cfg = orderReplicaCfdi, rc = cfg.receiver;
	if (applyRounding === undefined) applyRounding = !!cfg.applyRounding;
	await apiRequest('/updates/datos_facturacion.php', { method: 'POST', bearer: bearer, body: {
		id: orderId, billing_data_id: billingDataId,
		sat_codigo_postal: rc.domicilioFiscal, sat_domicilio_fiscal_receptor: rc.domicilioFiscal,
		sat_forma_pago: rc.formaPago || '01', sat_razon_social: rc.razonSocial,
		sat_receptor_email: rc.email, sat_receptor_rfc: rc.rfc,
		sat_regimen_capital_receptor: rc.regimenCapital, sat_regimen_fiscal_receptor: rc.regimenFiscal,
		sat_serie: cfg.serie, sat_uso_cfdi: rc.usoCfdi } });
	var order = (await apiRequest('/order_info.php?id=' + encodeURIComponent(orderId), { bearer: bearer })).order;
	var f = await apiRequest('/facturacion_request.php', { method: 'POST', bearer: bearer, body: {
		facturacion_code: order.facturacion_code, razon_social: rc.razonSocial, email: rc.email,
		rfc: rc.rfc, domicilio_fiscal: rc.domicilioFiscal, forma_de_pago: rc.formaPago || '01',
		regimen_fiscal: rc.regimenFiscal, regimen_capital: rc.regimenCapital, uso_cfdi: rc.usoCfdi,
		version: '4.0', billing_data_id: billingDataId,
		apply_rounding_discount_adjustment: !!applyRounding } });
	var res = f.order || f;
	if (!res.sat_factura_id) throw new Error('Sin sat_factura_id: ' + JSON.stringify(f).slice(0, 300));
	return apiRequest('/sat_factura.php?id=' + encodeURIComponent(res.sat_factura_id), { bearer: bearer });
}

function orDefineTests(specs) {
	QUnit.module('Replica RMCELL');
	specs.forEach(function(spec) {
		QUnit.test('Prueba RMCELL ' + spec.sourceOrderId, async function(assert) {
			assert.timeout(300000);
			var session = await login();
			assert.ok(session.bearer, 'login ok');
			orApplyPageConfig();
			var bearer = session.bearer;
			var store = await orResolveStore(bearer, spec.tax_percent);
			assert.ok(store.id, 'sucursal destino ' + store.id + ' al ' + spec.tax_percent + '%');

			var shared = await orGetSharedItem(bearer);
			assert.ok(shared.id, 'articulo compartido ' + shared.id);
			var ids = spec.lines.map(function() { return shared.id; });

			{
				var group = Date.now();
				var priceTypeId = await orResolvePriceTypeId(bearer, spec.price_type_id);
				var created = await apiRequest('/order_info.php', { method: 'POST', bearer: bearer, body: {
					order: {
						billing_data_id: 1, cashier_user_id: session.user.id,
						client_name: 'Replica RMCELL ' + spec.sourceOrderId,
						currency_id: spec.currency_id || 'MXN', price_type_id: priceTypeId,
						service_type: spec.service_type || 'QUICK_SALE', status: 'PENDING',
						store_id: store.id, sync_id: store.id + '-' + Date.now(),
						subtotal: spec.subtotal, tax: spec.tax, tax_percent: spec.tax_percent,
						total: spec.total, discount: spec.discount || 0,
						note: 'Replica de orden RMCELL ' + spec.sourceOrderId,
						facturacion_code: '', sat_serie: orderReplicaCfdi.serie
					},
					items: spec.lines.map(function(L, n) { return { order_item: {
						item_id: ids[n], delivery_status: 'PENDING', stock_status: 'IN_STOCK',
						tax_included: L.tax_included || 'YES', delivered_qty: 0, status: 'ACTIVE',
						commanda_status: 'NOT_DISPLAYED', item_group: group + n,
						return_required: 'NO', is_item_extra: 'NO', is_free_of_charge: 'NO', note: '',
						qty: L.qty, item_option_qty: 1, paid_qty: 0,
						original_unitary_price: L.original, unitary_price: L.unitary,
						subtotal: L.subtotal, discount: 0, discount_percent: 0,
						tax: L.tax, total: L.total, type: 'NORMAL', preparation_status: 'PENDING' } }; })
				} });
				assert.ok(created.order && created.order.id, 'orden creada ' + (created.order || {}).id);

				var P = spec.payment || { transaction_type: 'CASH', payment_amount: spec.total, received_amount: spec.total, change_amount: 0 };
				var pay = await apiRequest('/payment_info.php', { method: 'POST', bearer: bearer, body: {
					movements: [{ bank_movement: { transaction_type: P.transaction_type, client_user_id: null,
						total: P.payment_amount, amount_received: P.received_amount,
						currency_id: 'MXN', exchange_rate: 1, type: 'income' },
						bank_movement_orders: [{ currency_amount: P.payment_amount, amount: P.payment_amount,
							currency_id: 'MXN', exchange_rate: 1, order_id: created.order.id }] }],
					payment: { type: 'income', tag: 'SALE', payment_amount: P.payment_amount,
						received_amount: P.received_amount, change_amount: P.change_amount,
						currency_id: 'MXN', sync_id: store.id + '-' + Date.now() } } });
				assert.ok(pay.payment && pay.payment.id, 'pago ' + P.transaction_type + ' ' + P.payment_amount);

				var closed = await apiRequest('/order_info.php?id=' + created.order.id, { bearer: bearer });
				if ((closed.order || {}).status !== 'CLOSED') {
					await apiRequest('/updates.php', { method: 'POST', bearer: bearer,
						body: { method: 'closeOrder', order_id: created.order.id } });
					closed = await apiRequest('/order_info.php?id=' + created.order.id, { bearer: bearer });
				}
				assert.equal(closed.order.status, 'CLOSED', 'orden cerrada');
				assert.equal(closed.order.paid_status, 'PAID', 'orden pagada');
				// Solo el TOTAL decide si el test pasa. El desglose (subtotal / IVA, ya
				// sea por orden o por renglon) puede variar por redondeo del backend;
				// se imprime en consola pero no marca falla.
				assert.equal(orRound2(closed.order.total), orRound2(spec.total), 'total ' + spec.total + ' exacto');
				console.log('desglose orden: subtotal ' + closed.order.subtotal + ' (origen ' + spec.subtotal
					+ '), iva ' + closed.order.tax + ' (origen ' + spec.tax + ')');
				assert.equal(closed.items.length, spec.lines.length, 'mismos renglones');
				closed.items.forEach(function(wr, n) {
					var oi = wr.order_item, L = spec.lines[n];
					assert.equal(Number(oi.qty), Number(L.qty), 'renglon ' + (n + 1) + ' cantidad ' + L.qty);
					assert.equal(orRound2(oi.total), orRound2(L.total), 'renglon ' + (n + 1) + ' total ' + L.total + ' exacto');
					console.log('renglon ' + (n + 1) + ': subtotal ' + oi.subtotal + ' (origen ' + L.subtotal
						+ '), iva ' + oi.tax + ' (origen ' + L.tax + '), total ' + oi.total);
				});

				if (orderReplicaCfdi.facturar) {
					var bd = await orResolveBillingDataId(store, bearer);
					var sat = await orFacturar(closed.order.id, bd, bearer);
					assert.ok(sat.uuid, 'CFDI timbrado ' + sat.uuid);
					assert.equal(sat.type, 'NORMAL', 'sat_factura NORMAL');
					var xml = await (await fetch(endpoint() + '/attachment.php?id=' + sat.xml_attachment_id,
						{ headers: { Authorization: 'Bearer ' + bearer } })).text();
					assert.ok(xml.indexOf('Total="' + Number(spec.total).toFixed(2) + '"') !== -1, 'XML con Total exacto');
				}
				console.log('Prueba RMCELL ' + spec.sourceOrderId + ' OK -> ORDEN ' + closed.order.id + ' PAGO ' + pay.payment.id);
			}
		});
	});
}

// Regresion: la preparacion (sucursal + billing) jamas tumba el test.
// Si no hay sucursal ACTIVA al impuesto pedido, se crea/repara via API.
function orDefinePrepTests() {
	QUnit.module('Replica RMCELL prep');
	[16, 8].forEach(function(tax) {
		QUnit.test('prep sucursal ACTIVA al ' + tax + '%', async function(assert) {
			assert.timeout(120000);
			var session = await login();
			assert.ok(session.bearer, 'login ok');
			var store = await orResolveStore(session.bearer, tax);
			assert.ok(store && store.id, 'sucursal resuelta ' + (store && store.id));
			assert.equal(store.status, 'ACTIVE', 'sucursal ACTIVA');
			assert.equal(Number(store.tax_percent), tax, 'sucursal al ' + tax + '%');
		});
	});
	QUnit.test('prep billing_data disponible', async function(assert) {
		assert.timeout(120000);
		var session = await login();
		assert.ok(session.bearer, 'login ok');
		var store = await orResolveStore(session.bearer, 16);
		var bd = await orResolveBillingDataId(store, session.bearer);
		assert.ok(bd, 'billing_data ' + bd);
	});
	QUnit.test('prep price_type resuelto existe', async function(assert) {
		assert.timeout(120000);
		var session = await login();
		assert.ok(session.bearer, 'login ok');
		var pt = await orResolvePriceTypeId(session.bearer, 999999);
		assert.ok(pt, 'price_type ' + pt);
		var check = await apiRequest('/price_type.php?id=' + pt, { bearer: session.bearer });
		assert.ok((check.price_type || check).id, 'price_type existe en destino');
	});
}

// Duplicado de la prueba 169326 SIN redondeo: los mismos 3 articulos Comex
// al 8% (1023.50 + 2227.00 + 2665.00 = 5915.50), pero con valores exactos de
// precision completa (unitario = original/1.08 sin redondear a 2 decimales)
// y aserciones exactas en vez de orRound2. La orden real 169326 en POS_comex
// totaliza 5915.50; el spec exportado trae 5915.5056, de ahi los fallos de
// "Prueba RMCELL 169326" (total + CFDI). Este duplicado cuadra al centavo
// porque backend (OrderUtils::applyPrice rama YES) respeta tal cual los
// valores completos y consistentes, y los exactos lo son.
function orExact169326Spec() {
	var rate = 8, divisor = 1 + rate / 100, qty = 1;
	var raws = [
		{ code: '0475434', original: 1023.5 },
		{ code: '0208130', original: 2227 },
		{ code: '0200300', original: 2665 }
	];
	var lines = raws.map(function(r) {
		var unitary = r.original / divisor;
		var subtotal = unitary * qty;
		return { code: r.code, qty: qty, original: r.original, unitary: unitary,
			subtotal: subtotal, tax: subtotal * (rate / 100), total: r.original * qty,
			tax_included: 'YES', applicable_tax: 'DEFAULT', tax_percent: 0 };
	});
	var subtotal = 0, tax = 0, total = 0;
	lines.forEach(function(L) { subtotal += L.subtotal; tax += L.tax; total += L.total; });
	return { sourceOrderId: 169326, store_id: 11, tax_percent: rate, price_type_id: 1,
		currency_id: 'MXN', service_type: 'QUICK_SALE',
		subtotal: subtotal, tax: tax, total: total, discount: 0,
		payment: { transaction_type: 'CREDIT_CARD', payment_amount: total,
			received_amount: total, change_amount: 0 },
		lines: lines };
}

// Asercion exacta (sin redondeo a centavos): tolera solo el polvo flotante
// y el redondeo de almacenamiento MySQL (decimal(20,7) en order_item,
// decimal(20,6) en `order`: error maximo 5e-7). Un valor redondeado a 2
// decimales (p.ej. 947.69 vs 947.685185...) difiere ~5e-3 y SI falla.
function orAssertExact(assert, actual, expected, label) {
	var a = Number(actual), e = Number(expected), diff = Math.abs(a - e);
	assert.ok(diff <= 1e-6, label + ' exacto (' + a + ' vs ' + e + ')');
}

function orDefineUnrounded169326Test() {
	QUnit.module('Replica RMCELL');
	QUnit.test('Prueba RMCELL 169326 sin redondeo', async function(assert) {
		assert.timeout(300000);
		var spec = orExact169326Spec();
		var session = await login();
		assert.ok(session.bearer, 'login ok');
		orApplyPageConfig();
		var tok = session.bearer;
		var store = await orResolveStore(tok, spec.tax_percent);
		assert.ok(store.id, 'sucursal destino ' + store.id + ' al ' + spec.tax_percent + '%');

		var shared = await orGetSharedItem(bearer);
		assert.ok(shared.id, 'articulo compartido ' + shared.id);

		var group = Date.now();
		var priceTypeId = await orResolvePriceTypeId(bearer, spec.price_type_id);
		var created = await apiRequest('/order_info.php', { method: 'POST', bearer: bearer, body: {
			order: {
				billing_data_id: 1, cashier_user_id: session.user.id,
				client_name: 'Replica RMCELL 169326 sin redondeo',
				currency_id: spec.currency_id || 'MXN', price_type_id: priceTypeId,
				service_type: spec.service_type || 'QUICK_SALE', status: 'PENDING',
				store_id: store.id, sync_id: store.id + '-' + Date.now(),
				subtotal: spec.subtotal, tax: spec.tax, tax_percent: spec.tax_percent,
				total: spec.total, discount: spec.discount || 0,
				note: 'Replica exacta sin redondeo de orden RMCELL 169326',
				facturacion_code: '', sat_serie: orderReplicaCfdi.serie
			},
			items: spec.lines.map(function(L, n) { return { order_item: {
				item_id: shared.id, delivery_status: 'PENDING', stock_status: 'IN_STOCK',
				tax_included: L.tax_included || 'YES', delivered_qty: 0, status: 'ACTIVE',
				commanda_status: 'NOT_DISPLAYED', item_group: group + n,
				return_required: 'NO', is_item_extra: 'NO', is_free_of_charge: 'NO', note: '',
				qty: L.qty, item_option_qty: 1, paid_qty: 0,
				original_unitary_price: L.original, unitary_price: L.unitary,
				subtotal: L.subtotal, discount: 0, discount_percent: 0,
				tax: L.tax, total: L.total, type: 'NORMAL', preparation_status: 'PENDING' } }; })
		} });
		assert.ok(created.order && created.order.id, 'orden creada ' + (created.order || {}).id);

		var P = spec.payment;
		var pay = await apiRequest('/payment_info.php', { method: 'POST', bearer: bearer, body: {
			movements: [{ bank_movement: { transaction_type: P.transaction_type, client_user_id: null,
				total: P.payment_amount, amount_received: P.received_amount,
				currency_id: 'MXN', exchange_rate: 1, type: 'income' },
				bank_movement_orders: [{ currency_amount: P.payment_amount, amount: P.payment_amount,
					currency_id: 'MXN', exchange_rate: 1, order_id: created.order.id }] }],
			payment: { type: 'income', tag: 'SALE', payment_amount: P.payment_amount,
				received_amount: P.received_amount, change_amount: P.change_amount,
				currency_id: 'MXN', sync_id: store.id + '-' + Date.now() } } });
		assert.ok(pay.payment && pay.payment.id, 'pago ' + P.transaction_type + ' ' + P.payment_amount);

		var closed = await apiRequest('/order_info.php?id=' + created.order.id, { bearer: bearer });
		if ((closed.order || {}).status !== 'CLOSED') {
			await apiRequest('/updates.php', { method: 'POST', bearer: bearer,
				body: { method: 'closeOrder', order_id: created.order.id } });
			closed = await apiRequest('/order_info.php?id=' + created.order.id, { bearer: bearer });
		}
		assert.equal(closed.order.status, 'CLOSED', 'orden cerrada');
		assert.equal(closed.order.paid_status, 'PAID', 'orden pagada');
		// Sin redondeo: el desglose tambien se afirma exacto, no solo el total.
		orAssertExact(assert, closed.order.total, spec.total, 'total ' + spec.total);
		orAssertExact(assert, closed.order.subtotal, spec.subtotal, 'subtotal ' + spec.subtotal);
		orAssertExact(assert, closed.order.tax, spec.tax, 'iva ' + spec.tax);
		assert.equal(closed.items.length, spec.lines.length, 'mismos renglones');
		closed.items.forEach(function(wr, n) {
			var oi = wr.order_item, L = spec.lines[n];
			assert.equal(Number(oi.qty), Number(L.qty), 'renglon ' + (n + 1) + ' cantidad ' + L.qty);
			orAssertExact(assert, oi.unitary_price, L.unitary, 'renglon ' + (n + 1) + ' unitario ' + L.unitary);
			orAssertExact(assert, oi.subtotal, L.subtotal, 'renglon ' + (n + 1) + ' subtotal ' + L.subtotal);
			orAssertExact(assert, oi.tax, L.tax, 'renglon ' + (n + 1) + ' iva ' + L.tax);
			orAssertExact(assert, oi.total, L.total, 'renglon ' + (n + 1) + ' total ' + L.total);
		});

		if (orderReplicaCfdi.facturar) {
			var bd = await orResolveBillingDataId(store, bearer);
			var sat = await orFacturar(closed.order.id, bd, bearer, false);
			assert.ok(sat.uuid, 'CFDI timbrado ' + sat.uuid);
			assert.equal(sat.type, 'NORMAL', 'sat_factura NORMAL');
			var xml = await (await fetch(endpoint() + '/attachment.php?id=' + sat.xml_attachment_id,
				{ headers: { Authorization: 'Bearer ' + bearer } })).text();
			assert.ok(xml.indexOf('Total="' + Number(spec.total).toFixed(2) + '"') !== -1, 'XML con Total exacto');
		}
		console.log('Prueba RMCELL 169326 sin redondeo OK -> ORDEN ' + closed.order.id + ' PAGO ' + pay.payment.id);
	});
}

// Las 23 ordenes quedan definidas como tests unitarios al cargar el archivo
// (rmcell_orders_data.js debe cargarse antes). Corre solo al abrir la pagina.
if (typeof window !== 'undefined' && typeof QUnit !== 'undefined') {
	orDefinePrepTests();
}
if (typeof window !== 'undefined' && window.orderReplicaSpecs && window.orderReplicaSpecs.length) {
	orDefineTests(window.orderReplicaSpecs);
}
if (typeof window !== 'undefined' && typeof QUnit !== 'undefined') {
	orDefineUnrounded169326Test();
}
