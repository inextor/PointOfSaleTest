// Exporta ordenes reales (default: RMCELL 16%) a JSON listo para replicar.
// Correr con endpoint = origen. El JSON sale en textarea + descarga + consola.
var orderExportConfig = { limit: 5, storeId: 23, taxPercent: 16, minId: 0 };

async function oeFetchPayment(bearer, orderId) {
	var res = await apiRequest('/payment_info.php', {
		method: 'POST', bearer: bearer,
		body: { _post_search: 1, order_id: orderId }
	});
	var rows = res.data || res.result || [];
	if (!rows.length) return null;
	var first = rows[0];
	var mov = (first.movements || [])[0] || {};
	var bm = mov.bank_movement || {};
	return {
		transaction_type: bm.transaction_type || 'CASH',
		payment_amount: Number((first.payment || {}).payment_amount),
		received_amount: Number((first.payment || {}).received_amount),
		change_amount: Number((first.payment || {}).change_amount)
	};
}

async function oeExport(bearer, cfg) {
	var list = await apiRequest(
		'/order_info.php?_sort=id_DESC&limit=' + encodeURIComponent(cfg.limit)
		+ (cfg.storeId ? '&store_id=' + encodeURIComponent(cfg.storeId) : ''),
		{ bearer: bearer });
	var orders = (list.data || []).filter(function(w) {
		return Number(w.order.tax_percent) === Number(cfg.taxPercent)
			&& Number(w.order.id) >= Number(cfg.minId || 0);
	});
	var specs = [];
	for (var i = 0; i < orders.length; i++) {
		var w = orders[i], o = w.order;
		specs.push({
			sourceOrderId: o.id,
			store_id: o.store_id,
			tax_percent: Number(o.tax_percent),
			price_type_id: o.price_type_id,
			currency_id: o.currency_id || 'MXN',
			service_type: o.service_type || 'QUICK_SALE',
			subtotal: Number(o.subtotal),
			tax: Number(o.tax),
			total: Number(o.total),
			discount: Number(o.discount || 0),
			payment: await oeFetchPayment(bearer, o.id),
			lines: (w.items || []).map(function(it) {
				var oi = it.order_item, im = it.item || {};
				return {
					code: im.code || null,
					qty: Number(oi.qty),
					original: Number(oi.original_unitary_price),
					unitary: Number(oi.unitary_price),
					subtotal: Number(oi.subtotal),
					tax: Number(oi.tax),
					total: Number(oi.total),
					tax_included: oi.tax_included || 'YES',
					applicable_tax: im.applicable_tax || 'DEFAULT',
					tax_percent: Number(im.tax_percent || 0)
				};
			})
		});
	}
	return specs;
}

QUnit.module('Export ordenes RMCELL');

QUnit.test('exporta ordenes a JSON de replica', async function(assert) {
	assert.timeout(300000);
	var cfg = window.oeReadConfig ? window.oeReadConfig() : orderExportConfig;
	var session = await login();
	assert.ok(session.bearer, 'login ok');
	var specs = await oeExport(session.bearer, cfg);
	assert.ok(specs.length > 0, 'ordenes exportadas: ' + specs.length);
	specs.forEach(function(s) {
		assert.ok(s.lines.length > 0, 'orden ' + s.sourceOrderId + ' con ' + s.lines.length + ' renglones');
		assert.ok(s.payment, 'orden ' + s.sourceOrderId + ' con pago ' + (s.payment || {}).transaction_type);
	});
	var json = JSON.stringify(specs, null, 1);
	window.oeLastExport = json;
	var ta = document.getElementById('oe-output');
	if (ta) ta.value = json;
	console.log('EXPORT RMCELL (' + specs.length + ' ordenes):\n' + json);
});
