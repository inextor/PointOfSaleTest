// Politica canonica de billing_data: solo existen 2 cuentas PAC autorizadas.
// - Pruebas al 16%: demo1@sicofi.com.mx / demodemoD
// - Pruebas al 8% (estimulo fronterizo): fronterizodemo652@mail.com / 12345
// Todo timbrado usa precision 6 en ambas cuentas:
// 16%/6 (factura_truncado, quote_facturacion, order_replica 16%,
// factura_credito, factura_reuse, factura_pago_comun), 8%/6 (factura_179047,
// quote_replica_12349, order_replica 8%).
// Los resolvers (resolveCanonicalBillingDataId en test_utils.js) reutilizan
// estas filas y solo crean la combinacion canonica que falte.
QUnit.module('billing_data policy');

QUnit.test('solo existen las 2 cuentas PAC canonicas', async function(assert) {
	assert.timeout(60000);
	assert.expect(2);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const list = await apiRequest('/billing_data.php?limit=-1', { bearer: session.bearer });
	const rows = (list.data || list.result || [])
		.map(function(r) { return r.billing_data || r; })
		.filter(function(r) { return r && r.id; });

	const allowed = [
		billingDataPolicy.rate16.usuario,
		billingDataPolicy.rate8.usuario
	];
	const offenders = rows.filter(function(r) {
		const user = billingDataRowUser(r);
		return user && allowed.indexOf(user) === -1;
	});

	assert.deepEqual(
		offenders.map(function(r) { return r.id + '/' + billingDataRowUser(r); }),
		[],
		'toda fila con credenciales PAC usa una de las 2 cuentas canonicas'
	);
});

QUnit.test('combinaciones cuenta x precision 6 disponibles', async function(assert) {
	assert.timeout(60000);

	const session = await login();
	assert.ok(session.bearer, 'logged in');

	const list = await apiRequest('/billing_data.php?limit=-1', { bearer: session.bearer });
	const rows = (list.data || list.result || [])
		.map(function(r) { return r.billing_data || r; })
		.filter(function(r) { return r && r.id; });

	const cases = [
		{ rate: '16', precision: 6 },
		{ rate: '8', precision: 6 }
	];
	assert.expect(cases.length + 1);

	cases.forEach(function(c) {
		const pac = billingDataPolicyForRate(c.rate);
		const found = rows.some(function(r) {
			return billingDataRowUser(r) === pac.usuario && Number(r.precision) === Number(c.precision);
		});
		assert.ok(
			found,
			'combinacion ' + c.rate + '% precision ' + c.precision
			+ ' existe (cuenta ' + pac.usuario + ')'
		);
	});
});

