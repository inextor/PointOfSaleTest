QUnit.module('Order agent assignment');

function agentOrderItem(item) {
	return {
		order_item: {
			commanda_status: 'NOT_DISPLAYED',
			delivery_status: 'PENDING',
			discount: 0,
			discount_percent: 0,
			is_free_of_charge: 'NO',
			is_item_extra: 'NO',
			item_group: Date.now() + Math.floor(Math.random() * 10000),
			item_id: item.id,
			item_option_qty: 1,
			note: '',
			original_unitary_price: 15.5,
			paid_qty: 0,
			preparation_status: 'PENDING',
			qty: 1,
			return_required: 'NO',
			status: 'ACTIVE',
			stock_status: 'IN_STOCK',
			subtotal: 15.5,
			tax: 1.24,
			tax_included: 'NO',
			total: 16.74,
			unitary_price: 15.5
		}
	};
}

function agentOrderPayload(session, storeId, item, extraOrder) {
	return {
		order: Object.assign({
			billing_data_id: 1,
			cashier_user_id: session.user.id,
			client_name: 'PUBLICO GRAL',
			currency_id: 'MXN',
			discount: 0,
			price_type_id: 1,
			service_type: 'QUICK_SALE',
			status: 'PENDING',
			store_id: storeId,
			subtotal: 0,
			sync_id: 'agenttest-' + Date.now() + '-' + Math.floor(Math.random() * 1000000),
			tax: 0,
			tax_percent: 8,
			total: 0
		}, extraOrder || {}),
		items: [agentOrderItem(item)]
	};
}

async function findSecondUserAgent(session) {
	const users = await apiRequest('/user.php?type=USER&limit=30', { bearer: session.bearer });
	const rows = users.data || [];
	return rows.find((u) => u.id !== session.user.id && u.type === 'USER') || null;
}

async function createAgentTestClient(session, storeId) {
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			creation_store_id: storeId,
			credit_days: 0,
			credit_limit: 0,
			name: uniqueName('Agent Test Client'),
			price_type_id: 1,
			status: 'ACTIVE',
			type: 'CLIENT'
		}
	});

	if (!client.id) {
		throw new Error('Agent test client creation did not return id: ' + JSON.stringify(client));
	}

	return client;
}

async function findAgentTestClient(session) {
	const clients = await apiRequest('/user.php?type=CLIENT&limit=50', { bearer: session.bearer });
	const rows = clients.data || [];
	return rows.find((c) => c.created_by_user_id && Number(c.created_by_user_id) !== Number(session.user.id))
		|| rows.find((c) => c.created_by_user_id)
		|| null;
}

async function findClosedOrder(session) {
	const search = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: { _post_search: 1, status: 'CLOSED', limit: 1 }
	});
	const rows = (search.data || []).map((r) => r.order || r);
	return rows[0] || null;
}

async function canApproveCommissions(session) {
	try {
		const perm = await apiRequest('/user_permission.php?user_id=' + session.user.id, { bearer: session.bearer });
		return (perm.data || []).some((p) => p.approve_commissions);
	} catch (error) {
		return false;
	}
}

	QUnit.test('create without client defaults agent to creator', async function(assert) {
		assert.timeout(60000);
		assert.expect(4);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const item = await getOrCreateItem(session.bearer, {
			availability_type: 'ALWAYS',
			clave_sat: '53111603',
			name: 'Agent Test Item',
			note_required: 'NO',
			on_sale: 'NO',
			reference_price: 0,
			status: 'ACTIVE',
			unidad_medida_sat_id: 'H87'
		});

		const created = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: agentOrderPayload(session, storeId, item)
		});
		assert.ok(created.order && created.order.id, 'created order');
		const orderId = created.order.id;

		try {
			assert.equal(Number(created.order.agent_user_id), Number(session.user.id), 'agent defaults to creator');
			assert.ok(created.agent && Number(created.agent.id) === Number(session.user.id), 'getInfo enriches agent');
			assert.ok(!created.agent || !created.agent.password, 'agent has no password');
		} finally {
			await cancelTestOrder(session.bearer, orderId);
		}
	});

	QUnit.test('create with client defaults agent to client creator', async function(assert) {
		assert.timeout(60000);
		assert.expect(3);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const item = await getOrCreateItem(session.bearer, {
			availability_type: 'ALWAYS',
			clave_sat: '53111603',
			name: 'Agent Test Item',
			note_required: 'NO',
			on_sale: 'NO',
			reference_price: 0,
			status: 'ACTIVE',
			unidad_medida_sat_id: 'H87'
		});
		const client = await findAgentTestClient(session) || await createAgentTestClient(session, storeId);

		const created = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: agentOrderPayload(session, storeId, item, { client_user_id: client.id, client_name: client.name })
		});
		assert.ok(created.order && created.order.id, 'created order');
		const orderId = created.order.id;

		try {
			assert.equal(Number(created.order.agent_user_id), Number(client.created_by_user_id), 'agent defaults to client creator');
			assert.ok(created.agent && Number(created.agent.id) === Number(client.created_by_user_id), 'getInfo agent matches');
		} finally {
			await cancelTestOrder(session.bearer, orderId);
		}
	});

	QUnit.test('explicit agent is kept, unknown agent is rejected on create', async function(assert) {
		assert.timeout(60000);
		assert.expect(3);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const other = await findSecondUserAgent(session);
		assert.ok(other, 'second USER agent exists');
		const item = await getOrCreateItem(session.bearer, {
			availability_type: 'ALWAYS',
			clave_sat: '53111603',
			name: 'Agent Test Item',
			note_required: 'NO',
			on_sale: 'NO',
			reference_price: 0,
			status: 'ACTIVE',
			unidad_medida_sat_id: 'H87'
		});

		const created = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: agentOrderPayload(session, storeId, item, { agent_user_id: other.id })
		});
		assert.equal(Number(created.order.agent_user_id), Number(other.id), 'explicit agent kept');

		let error = null;
		try {
			await apiRequest('/order_info.php', {
				method: 'POST',
				bearer: session.bearer,
				body: agentOrderPayload(session, storeId, item, { agent_user_id: 999999 })
			});
		} catch (e) { error = e.message; }
		assert.ok(error && /agente/i.test(error), 'unknown agent rejected: ' + error);

		await cancelTestOrder(session.bearer, created.order.id);
	});

	QUnit.test('save changes agent on open order, unknown agent rejected', async function(assert) {
		assert.timeout(60000);
		assert.expect(3);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const other = await findSecondUserAgent(session);
		assert.ok(other, 'second USER agent exists');
		const item = await getOrCreateItem(session.bearer, {
			availability_type: 'ALWAYS',
			clave_sat: '53111603',
			name: 'Agent Test Item',
			note_required: 'NO',
			on_sale: 'NO',
			reference_price: 0,
			status: 'ACTIVE',
			unidad_medida_sat_id: 'H87'
		});
		const created = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: agentOrderPayload(session, storeId, item)
		});
		const orderId = created.order.id;

		try {
			const updated = await apiRequest('/order_info.php', {
				method: 'PUT',
				bearer: session.bearer,
				body: { order: { id: orderId, agent_user_id: other.id } }
			});
			assert.equal(Number(updated.order.agent_user_id), Number(other.id), 'agent changed on PENDING order');

			let error = null;
			try {
				await apiRequest('/order_info.php', {
					method: 'PUT',
					bearer: session.bearer,
					body: { order: { id: orderId, agent_user_id: 999998 } }
				});
			} catch (e) { error = e.message; }
			assert.ok(error && /agente/i.test(error), 'unknown agent rejected on save: ' + error);
		} finally {
			await cancelTestOrder(session.bearer, orderId);
		}
	});

	QUnit.test('update_order_agent endpoint on open order', async function(assert) {
		assert.timeout(60000);
		assert.expect(7);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const other = await findSecondUserAgent(session);
		assert.ok(other, 'second USER agent exists');
		const item = await getOrCreateItem(session.bearer, {
			availability_type: 'ALWAYS',
			clave_sat: '53111603',
			name: 'Agent Test Item',
			note_required: 'NO',
			on_sale: 'NO',
			reference_price: 0,
			status: 'ACTIVE',
			unidad_medida_sat_id: 'H87'
		});
		const created = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: agentOrderPayload(session, storeId, item)
		});
		const orderId = created.order.id;

		try {
			const moved = await apiRequest('/updates/update_order_agent.php', {
				method: 'POST',
				bearer: session.bearer,
				body: { order_id: orderId, agent_user_id: other.id }
			});
			assert.equal(Number(moved.order.agent_user_id), Number(other.id), 'endpoint reassigns agent');
			assert.ok(moved.agent && Number(moved.agent.id) === Number(other.id), 'endpoint returns agent');
			assert.ok(!moved.agent || !moved.agent.password, 'returned agent has no password');

			const filtered = await apiRequest('/order_info.php?agent_user_id=' + other.id + '&limit=50', { bearer: session.bearer });
			const rows = (filtered.data || []).map((r) => r.order || r);
			assert.ok(rows.some((r) => Number(r.id) === Number(orderId)), 'agent filter finds overridden order');

			let unknownError = null;
			try {
				await apiRequest('/updates/update_order_agent.php', {
					method: 'POST',
					bearer: session.bearer,
					body: { order_id: orderId, agent_user_id: 999997 }
				});
			} catch (e) { unknownError = e.message; }
			assert.ok(unknownError && /agente/i.test(unknownError), 'unknown agent rejected: ' + unknownError);

			const cleared = await apiRequest('/updates/update_order_agent.php', {
				method: 'POST',
				bearer: session.bearer,
				body: { order_id: orderId, agent_user_id: null }
			});
			assert.ok(cleared.order.agent_user_id === null || cleared.order.agent_user_id === undefined, 'null clears stored agent');
		} finally {
			await cancelTestOrder(session.bearer, orderId);
		}
	});

	QUnit.test('cancelled order rejects agent changes', async function(assert) {
		assert.timeout(60000);
		assert.expect(4);

		const session = await login();
		const storeId = Number(session.user.store_id || testConfig.storeId);
		const other = await findSecondUserAgent(session);
		assert.ok(other, 'second USER agent exists');
		const item = await getOrCreateItem(session.bearer, {
			availability_type: 'ALWAYS',
			clave_sat: '53111603',
			name: 'Agent Test Item',
			note_required: 'NO',
			on_sale: 'NO',
			reference_price: 0,
			status: 'ACTIVE',
			unidad_medida_sat_id: 'H87'
		});
		const created = await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: agentOrderPayload(session, storeId, item)
		});
		const orderId = created.order.id;
		await cancelTestOrder(session.bearer, orderId);

		const cancelled = await apiRequest('/order_info.php?id=' + orderId, { bearer: session.bearer });
		assert.equal(cancelled.status || (cancelled.order || {}).status, 'CANCELLED', 'order is cancelled');

		let saveError = null;
		try {
			await apiRequest('/order_info.php', {
				method: 'PUT',
				bearer: session.bearer,
				body: { order: { id: orderId, agent_user_id: other.id } }
			});
		} catch (e) { saveError = e.message; }
		assert.ok(saveError && /update_order_agent/i.test(saveError), 'save points to endpoint: ' + saveError);

		let endpointError = null;
		try {
			await apiRequest('/updates/update_order_agent.php', {
				method: 'POST',
				bearer: session.bearer,
				body: { order_id: orderId, agent_user_id: session.user.id }
			});
		} catch (e) { endpointError = e.message; }
		assert.ok(endpointError && /cancelada/i.test(endpointError), 'endpoint rejects cancelled: ' + endpointError);
	});

	QUnit.test('closed order agent change follows permission rule', async function(assert) {
		assert.timeout(60000);

		const session = await login();
		const closed = await findClosedOrder(session);
		if (!closed) {
			assert.ok(true, 'SKIP: no CLOSED order in tenant');
			return;
		}
		const allowed = await canApproveCommissions(session);
		const other = await findSecondUserAgent(session);

		if (allowed && other && Number(closed.agent_user_id) !== Number(other.id)) {
			assert.expect(4);
			const original = closed.agent_user_id;
			const moved = await apiRequest('/updates/update_order_agent.php', {
				method: 'POST',
				bearer: session.bearer,
				body: { order_id: closed.id, agent_user_id: other.id }
			});
			assert.equal(Number(moved.order.agent_user_id), Number(other.id), 'permitted change succeeds');
			const restored = await apiRequest('/updates/update_order_agent.php', {
				method: 'POST',
				bearer: session.bearer,
				body: { order_id: closed.id, agent_user_id: original }
			});
			assert.equal(
				restored.order.agent_user_id === null ? null : Number(restored.order.agent_user_id),
				original === null ? null : Number(original),
				'agent restored to original value'
			);

			let saveError = null;
			try {
				await apiRequest('/order_info.php', {
					method: 'PUT',
					bearer: session.bearer,
					body: { order: { id: closed.id, agent_user_id: other.id } }
				});
			} catch (e) { saveError = e.message; }
			assert.ok(saveError && /update_order_agent/i.test(saveError), 'save on CLOSED points to endpoint: ' + saveError);

			const reread = await apiRequest('/order_info.php?id=' + closed.id, { bearer: session.bearer });
			const current = reread.order || reread;
			assert.equal(
				current.agent_user_id === null ? null : Number(current.agent_user_id),
				original === null ? null : Number(original),
				'order left untouched'
			);
		} else if (!allowed) {
			assert.expect(2);
			let endpointError = null;
			try {
				await apiRequest('/updates/update_order_agent.php', {
					method: 'POST',
					bearer: session.bearer,
					body: { order_id: closed.id, agent_user_id: session.user.id }
				});
			} catch (e) { endpointError = e.message; }
			assert.ok(endpointError && /comision/i.test(endpointError), 'forbidden without approve_commissions: ' + endpointError);

			let saveError = null;
			try {
				await apiRequest('/order_info.php', {
					method: 'PUT',
					bearer: session.bearer,
					body: { order: { id: closed.id, agent_user_id: session.user.id } }
				});
			} catch (e) { saveError = e.message; }
			assert.ok(!saveError || /update_order_agent/i.test(saveError), 'save on CLOSED rejected or no-op: ' + saveError);
		} else {
			assert.ok(true, 'SKIP: closed order already assigned to the only other agent');
		}
	});
