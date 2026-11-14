QUnit.module('Object profile forms & searchable responses');

function objectOrderItem(item) {
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
			original_unitary_price: 1500,
			paid_qty: 0,
			preparation_status: 'PENDING',
			qty: 1,
			return_required: 'NO',
			status: 'ACTIVE',
			stock_status: 'IN_STOCK',
			subtotal: 1500,
			tax: 240,
			tax_included: 'NO',
			total: 1740,
			unitary_price: 1500
		}
	};
}

async function createObjectTestClient(session, storeId, prefix) {
	const client = await apiRequest('/user.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			creation_store_id: storeId,
			credit_days: 0,
			credit_limit: 0,
			name: uniqueName(prefix || 'Object Test Client'),
			price_type_id: 1,
			status: 'ACTIVE',
			type: 'CLIENT'
		}
	});

	if (!client.id) {
		throw new Error('Object test client creation did not return id: ' + JSON.stringify(client));
	}

	return client;
}

async function createCarObjectForm(session) {
	const suffix = Date.now() + '-' + Math.floor(Math.random() * 100000);
	const created = await apiRequest('/form_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			form: {
				title: 'Automóvil ' + suffix,
				description: 'Perfil de vehículo del cliente',
				purpose: 'OBJECT_PROFILE',
				identifier_title: 'Placa',
				is_response_title_required: 1,
				responses_allowed: 999,
				is_active: 1
			},
			questions: [
				{ question: 'Placa', type: 'text', required: 1, priority: 1, status: 'ACTIVE', is_identifier: 1, is_searchable: 1, allow_multiple: 0 },
				{ question: 'VIN', type: 'text', required: 0, priority: 2, status: 'ACTIVE', is_identifier: 0, is_searchable: 1, allow_multiple: 0 },
				{ question: 'Marca', type: 'text', required: 1, priority: 3, status: 'ACTIVE', is_identifier: 0, is_searchable: 1, allow_multiple: 0 },
				{ question: 'Modelo', type: 'text', required: 1, priority: 4, status: 'ACTIVE', is_identifier: 0, is_searchable: 1, allow_multiple: 0 },
				{ question: 'Año', type: 'number', required: 0, priority: 5, status: 'ACTIVE', is_identifier: 0, is_searchable: 1, allow_multiple: 0 },
				{ question: 'Color', type: 'text', required: 0, priority: 6, status: 'ACTIVE', is_identifier: 0, is_searchable: 1, allow_multiple: 0 },
				{ question: 'Alias', type: 'text', required: 0, priority: 7, status: 'ACTIVE', is_identifier: 0, is_searchable: 1, allow_multiple: 1 }
			]
		}
	});

	const questionsByName = {};
	(created.questions || []).forEach((q) => {
		questionsByName[q.question] = q;
	});

	return {
		form: created.form,
		questions: created.questions || [],
		questionsByName: questionsByName
	};
}

async function createServiceIntakeForm(session) {
	const suffix = Date.now() + '-' + Math.floor(Math.random() * 100000);
	const created = await apiRequest('/form_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			form: {
				title: 'Ingreso Taller ' + suffix,
				description: 'Cuestionario de ingreso al taller',
				purpose: 'GENERIC',
				is_response_title_required: 0,
				responses_allowed: 999,
				is_active: 1
			},
			questions: [
				{ question: 'Kilometraje', type: 'number', required: 1, priority: 1, status: 'ACTIVE', is_identifier: 0, is_searchable: 1, allow_multiple: 0 },
				{ question: 'Servicio solicitado', type: 'textarea', required: 1, priority: 2, status: 'ACTIVE', is_identifier: 0, is_searchable: 1, allow_multiple: 0 }
			]
		}
	});

	const questionsByName = {};
	(created.questions || []).forEach((q) => {
		questionsByName[q.question] = q;
	});

	return {
		form: created.form,
		questions: created.questions || [],
		questionsByName: questionsByName
	};
}

QUnit.test('create OBJECT_PROFILE and GENERIC forms, filter by purpose', async function(assert) {
	assert.timeout(60000);
	assert.expect(7);

	const session = await login();
	const carSetup = await createCarObjectForm(session);
	const intakeSetup = await createServiceIntakeForm(session);

	assert.equal(carSetup.form.purpose, 'OBJECT_PROFILE', 'Car form saved with purpose = OBJECT_PROFILE');
	assert.equal(carSetup.form.identifier_title, 'Placa', 'Car form saved with identifier_title = Placa');
	assert.equal(Number(carSetup.questionsByName['Placa'].is_identifier), 1, 'Placa question has is_identifier = 1');
	assert.equal(Number(carSetup.questionsByName['Alias'].allow_multiple), 1, 'Alias question has allow_multiple = 1');
	assert.equal(intakeSetup.form.purpose, 'GENERIC', 'Intake form saved with purpose = GENERIC');

	const objectForms = await apiRequest('/form_info.php?purpose=OBJECT_PROFILE&limit=-1', { bearer: session.bearer });
	const objectFormIds = (objectForms.data || []).map((row) => Number((row.form || row).id));
	assert.ok(objectFormIds.includes(Number(carSetup.form.id)), 'purpose=OBJECT_PROFILE filter returns Car form');
	assert.notOk(objectFormIds.includes(Number(intakeSetup.form.id)), 'purpose=OBJECT_PROFILE filter excludes GENERIC form');
});

QUnit.test('create client cars, sync identifier, repeatable aliases, PUT diffing, and Object search', async function(assert) {
	assert.timeout(60000);
	assert.expect(14);

	const session = await login();
	const storeId = Number(session.user.store_id || testConfig.storeId);
	const carSetup = await createCarObjectForm(session);
	const client1 = await createObjectTestClient(session, storeId, 'Taller Cliente');

	const uniqueToken = String(Date.now()).slice(-5);
	const plate1 = 'ABC-' + uniqueToken;
	const plate2 = 'XYZ-' + uniqueToken;
	const aliasTag = 'chaparrito_' + uniqueToken;

	const qByName = carSetup.questionsByName;

	const car1Created = await apiRequest('/response_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			response: {
				form_id: carSetup.form.id,
				user_id: client1.id,
				title: plate1 + ' - Ford F-150 Blanco'
			},
			answers: [
				{ answer: { question_id: qByName['Placa'].id, answer_text: plate1 } },
				{ answer: { question_id: qByName['VIN'].id, answer_text: '1FTFW1ET' + uniqueToken } },
				{ answer: { question_id: qByName['Marca'].id, answer_text: 'Ford' } },
				{ answer: { question_id: qByName['Modelo'].id, answer_text: 'F-150' } },
				{ answer: { question_id: qByName['Año'].id, answer_number: 2020 } },
				{ answer: { question_id: qByName['Color'].id, answer_text: 'Blanco' } },
				{
					question: { id: qByName['Alias'].id },
					answers: [
						{ question_id: qByName['Alias'].id, answer_text: 'Jose ' + uniqueToken },
						{ question_id: qByName['Alias'].id, answer_text: 'Pepe esquina ' + uniqueToken },
						{ question_id: qByName['Alias'].id, answer_text: 'El ' + aliasTag }
					]
				}
			]
		}
	});

	const car2Created = await apiRequest('/response_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			response: {
				form_id: carSetup.form.id,
				user_id: client1.id,
				title: plate2 + ' - Nissan Versa Rojo'
			},
			answers: [
				{ answer: { question_id: qByName['Placa'].id, answer_text: plate2 } },
				{ answer: { question_id: qByName['Marca'].id, answer_text: 'Nissan' } },
				{ answer: { question_id: qByName['Modelo'].id, answer_text: 'Versa' } },
				{ answer: { question_id: qByName['Color'].id, answer_text: 'Rojo' } }
			]
		}
	});

	assert.equal(car1Created.response.identifier, plate1, 'Car 1 identifier synced from Placa answer');
	assert.equal(car2Created.response.identifier, plate2, 'Car 2 identifier synced from Placa answer');
	assert.equal(car1Created.response.status, 'ACTIVE', 'Car 1 status defaults to ACTIVE');

	const placaEntry = (car1Created.answers || []).find((a) => Number(a.question.id) === Number(qByName['Placa'].id));
	const aliasEntry = (car1Created.answers || []).find((a) => Number(a.question.id) === Number(qByName['Alias'].id));
	assert.ok(placaEntry && placaEntry.answer && !placaEntry.answers, 'allow_multiple=0 returns single answer object');
	assert.ok(aliasEntry && Array.isArray(aliasEntry.answers) && aliasEntry.answers.length === 3, 'allow_multiple=1 returns answers array with 3 aliases');

	// Update repeatable aliases via PUT (keep 1, update 1, delete 1, insert 1)
	const keptAlias = aliasEntry.answers[0];
	const editedAlias = Object.assign({}, aliasEntry.answers[1], { answer_text: 'Don Pepe editado ' + uniqueToken });
	const car1Updated = await apiRequest('/response_info.php', {
		method: 'PUT',
		bearer: session.bearer,
		body: {
			response: car1Created.response,
			answers: [
				{
					question: { id: qByName['Alias'].id },
					answers: [
						keptAlias,
						editedAlias,
						{ question_id: qByName['Alias'].id, answer_text: 'Nuevo ' + aliasTag }
					]
				}
			]
		}
	});

	const updatedAliasEntry = (car1Updated.answers || []).find((a) => Number(a.question.id) === Number(qByName['Alias'].id));
	const updatedAliasTexts = (updatedAliasEntry.answers || []).map((a) => a.answer_text);
	const updatedMarcaEntry = (car1Updated.answers || []).find((a) => Number(a.question.id) === Number(qByName['Marca'].id));

	assert.equal(updatedAliasTexts.length, 3, 'PUT diffing kept 3 repeatable answers');
	assert.ok(
		updatedAliasTexts.includes('Jose ' + uniqueToken)
		&& updatedAliasTexts.includes('Don Pepe editado ' + uniqueToken)
		&& updatedAliasTexts.includes('Nuevo ' + aliasTag),
		'PUT diffing inserted, updated, and deleted repeatable answers accurately'
	);
	assert.equal(updatedMarcaEntry.answer.answer_text, 'Ford', 'PUT on repeatable answers left single-value Marca untouched');

	// Search by owner + form_id
	const clientCars = await apiRequest(
		'/response_info.php?user_id=' + client1.id + '&form_id=' + carSetup.form.id,
		{ bearer: session.bearer }
	);
	assert.equal(Number(clientCars.total), 2, 'Client owns both cars');

	// Search by exact identifier
	const exactPlateSearch = await apiRequest(
		'/response_info.php?form_id=' + carSetup.form.id + '&identifier=' + encodeURIComponent(plate1),
		{ bearer: session.bearer }
	);
	assert.equal(Number(exactPlateSearch.total), 1, 'Exact identifier search finds Car 1');
	assert.equal(Number(exactPlateSearch.data[0].response.id), Number(car1Created.response.id), 'Exact identifier returns Car 1 id');

	// Search by partial identifier~~
	const partialPlateSearch = await apiRequest(
		'/response_info.php?form_id=' + carSetup.form.id + '&identifier~~=' + encodeURIComponent('BC-' + uniqueToken),
		{ bearer: session.bearer }
	);
	assert.equal(Number(partialPlateSearch.total), 1, 'Partial identifier~~ search finds Car 1');

	// Search by alias (answer_value~~)
	const aliasSearch = await apiRequest(
		'/response_info.php?form_id=' + carSetup.form.id + '&answer_value~~=' + encodeURIComponent(aliasTag),
		{ bearer: session.bearer }
	);
	assert.equal(Number(aliasSearch.total), 1, 'Search by alias (answer_value~~) finds Car 1');

	// Multi-alias match on the same car returns 1 row (grouped by response.id)
	const multiAliasMatch = await apiRequest(
		'/response_info.php?form_id=' + carSetup.form.id + '&question_id=' + qByName['Alias'].id + '&answer_value~~=' + encodeURIComponent(uniqueToken),
		{ bearer: session.bearer }
	);
	assert.equal(Number(multiAliasMatch.total), 1, 'Multi-alias match on one car returns 1 row without duplicates');
});

QUnit.test('link Object to Order and Quote, verify enrichment and search by plate, alias, and answer value', async function(assert) {
	assert.timeout(60000);
	assert.expect(11);

	const session = await login();
	const storeId = Number(session.user.store_id || testConfig.storeId);
	const carSetup = await createCarObjectForm(session);
	const intakeSetup = await createServiceIntakeForm(session);
	const client1 = await createObjectTestClient(session, storeId, 'Ordenes Cliente');
	const item = await getOrCreateItem(session.bearer, {
		availability_type: 'ALWAYS',
		clave_sat: '53111603',
		name: 'Servicio Taller Frenos Test',
		note_required: 'NO',
		on_sale: 'NO',
		reference_price: 1500,
		status: 'ACTIVE',
		unidad_medida_sat_id: 'H87'
	});

	const uniqueToken = String(Date.now()).slice(-5);
	const plate = 'ORD-' + uniqueToken;
	const aliasText = 'alias_orden_' + uniqueToken;
	const serviceText = 'Rectificado discos ' + uniqueToken;

	const carCreated = await apiRequest('/response_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			response: {
				form_id: carSetup.form.id,
				user_id: client1.id,
				title: plate + ' - Mazda 3'
			},
			answers: [
				{ answer: { question_id: carSetup.questionsByName['Placa'].id, answer_text: plate } },
				{ answer: { question_id: carSetup.questionsByName['Marca'].id, answer_text: 'Mazda' } },
				{ answer: { question_id: carSetup.questionsByName['Modelo'].id, answer_text: '3' } },
				{
					question: { id: carSetup.questionsByName['Alias'].id },
					answers: [
						{ question_id: carSetup.questionsByName['Alias'].id, answer_text: aliasText }
					]
				}
			]
		}
	});

	const orderCreated = await apiRequest('/order_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			order: {
				billing_data_id: 1,
				cashier_user_id: session.user.id,
				client_user_id: client1.id,
				client_name: client1.name,
				currency_id: 'MXN',
				discount: 0,
				price_type_id: 1,
				service_type: 'IN_PLACE',
				status: 'PENDING',
				store_id: storeId,
				subtotal: 1500,
				sync_id: 'objorder-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
				tax: 240,
				tax_percent: 16,
				total: 1740
			},
			items: [objectOrderItem(item)],
			responses: [
				{
					order_response: {
						response_id: carCreated.response.id
					}
				},
				{
					response: {
						form_id: intakeSetup.form.id,
						user_id: client1.id,
						title: 'Ingreso ' + plate
					},
					answers: [
						{ answer: { question_id: intakeSetup.questionsByName['Kilometraje'].id, answer_number: 85000, answer_text: '85000' } },
						{ answer: { question_id: intakeSetup.questionsByName['Servicio solicitado'].id, answer_text: serviceText } }
					]
				}
			]
		}
	});

	const orderId = orderCreated.order.id;

	try {
		assert.equal((orderCreated.responses || []).length, 2, 'Order linked to Car OBJECT_PROFILE and Intake GENERIC form');
		const carOrderResponse = orderCreated.responses.find((r) => Number(r.response.id) === Number(carCreated.response.id));
		assert.equal(carOrderResponse.identifier, plate, 'Order response enriched with identifier');
		assert.equal(carOrderResponse.identifier_title, 'Placa', 'Order response enriched with identifier_title');
		assert.equal(Number(carOrderResponse.user.id), Number(client1.id), 'Order response enriched with owning client');

		const orderResponseList = await apiRequest(
			'/order_response_info.php?order_id=' + orderId + '&response_id=' + carCreated.response.id,
			{ bearer: session.bearer }
		);
		assert.equal(orderResponseList.data[0].identifier, plate, 'order_response_info.php enriches Object identifier');

		const orderByPlate = await apiRequest('/order_info.php?identifier~~=' + encodeURIComponent(plate), { bearer: session.bearer });
		assert.equal(Number(orderByPlate.total), 1, 'Search order by plate (identifier~~) returns 1 order');
		assert.equal(Number(orderByPlate.data[0].order.id), Number(orderId), 'Order found by plate matches orderId');

		const orderByAlias = await apiRequest('/order_info.php?answer_value~~=' + encodeURIComponent(aliasText), { bearer: session.bearer });
		assert.equal(Number(orderByAlias.total), 1, 'Search order by car alias (answer_value~~) returns 1 order');

		const orderByService = await apiRequest('/order_info.php?answer_value~~=' + encodeURIComponent(serviceText), { bearer: session.bearer });
		assert.equal(Number(orderByService.total), 1, 'Search order by service intake answer (answer_value~~) returns 1 order');

		const orderByObject = await apiRequest(
			'/order_info.php?object_response_id=' + carCreated.response.id + '&client_user_id=' + client1.id,
			{ bearer: session.bearer }
		);
		assert.equal(Number(orderByObject.total), 1, 'Search order by object_response_id + client_user_id returns 1 order');

		// Quote flow linked to the same Car
		const quoteCreated = await apiRequest('/quote_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				quote: {
					store_id: storeId,
					client_user_id: client1.id,
					name: client1.name,
					email: 'cliente@integranet.xyz',
					phone: '5551234567',
					sync_id: 'objquote-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
					tax_percent: 16
				},
				items: [
					{
						quote_item: {
							item_id: item.id,
							qty: 1,
							unitary_price: 1500,
							provider_price: 1500,
							original_unitary_price: 1500,
							discount: 0,
							subtotal: 1500,
							tax: 240,
							total: 1740,
							tax_included: 'NO',
							status: 'ACTIVE'
						}
					}
				],
				responses: [
					{
						quote_response: {
							response_id: carCreated.response.id
						}
					}
				]
			}
		});

		const quoteByPlate = await apiRequest('/quote_info.php?identifier~~=' + encodeURIComponent(plate), { bearer: session.bearer });
		assert.ok(
			Number(quoteByPlate.total) === 1 && Number(quoteByPlate.data[0].quote.id) === Number(quoteCreated.quote.id),
			'Quote linked to Car is searchable by plate (identifier~~)'
		);
	} finally {
		await cancelTestOrder(session.bearer, orderId);
	}
});

QUnit.test('negative guards: duplicate identifier, wrong client owner, and INACTIVE Object lifecycle', async function(assert) {
	assert.timeout(60000);
	assert.expect(5);

	const session = await login();
	const storeId = Number(session.user.store_id || testConfig.storeId);
	const carSetup = await createCarObjectForm(session);
	const client1 = await createObjectTestClient(session, storeId, 'Owner 1');
	const client2 = await createObjectTestClient(session, storeId, 'Owner 2');
	const item = await getOrCreateItem(session.bearer, {
		availability_type: 'ALWAYS',
		clave_sat: '53111603',
		name: 'Servicio Taller Guard Test',
		note_required: 'NO',
		on_sale: 'NO',
		reference_price: 500,
		status: 'ACTIVE',
		unidad_medida_sat_id: 'H87'
	});

	const plate = 'DUP-' + String(Date.now()).slice(-5);

	const car1 = await apiRequest('/response_info.php', {
		method: 'POST',
		bearer: session.bearer,
		body: {
			response: {
				form_id: carSetup.form.id,
				user_id: client1.id,
				title: plate + ' - Honda Civic'
			},
			answers: [
				{ answer: { question_id: carSetup.questionsByName['Placa'].id, answer_text: plate } },
				{ answer: { question_id: carSetup.questionsByName['Marca'].id, answer_text: 'Honda' } },
				{ answer: { question_id: carSetup.questionsByName['Modelo'].id, answer_text: 'Civic' } }
			]
		}
	});

	// 1. Duplicate identifier on the same form must fail
	let duplicateError = null;
	try {
		await apiRequest('/response_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				response: {
					form_id: carSetup.form.id,
					user_id: client2.id,
					title: plate + ' - Duplicado'
				},
				answers: [
					{ answer: { question_id: carSetup.questionsByName['Placa'].id, answer_text: plate } }
				]
			}
		});
	} catch (e) {
		duplicateError = e.message;
	}
	assert.ok(duplicateError && /identificador/i.test(duplicateError), 'Duplicate identifier on same form is rejected: ' + duplicateError);

	// 2. Linking Client 1 Car to an Order for Client 2 must fail
	let wrongOwnerError = null;
	try {
		await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				order: {
					billing_data_id: 1,
					cashier_user_id: session.user.id,
					client_user_id: client2.id,
					client_name: client2.name,
					currency_id: 'MXN',
					discount: 0,
					price_type_id: 1,
					service_type: 'IN_PLACE',
					status: 'PENDING',
					store_id: storeId,
					subtotal: 500,
					sync_id: 'wrongowner-' + Date.now(),
					tax: 80,
					tax_percent: 16,
					total: 580
				},
				items: [objectOrderItem(item)],
				responses: [
					{ order_response: { response_id: car1.response.id } }
				]
			}
		});
	} catch (e) {
		wrongOwnerError = e.message;
	}
	assert.ok(wrongOwnerError && /pertenece/i.test(wrongOwnerError), 'Linking Object owned by another client is rejected: ' + wrongOwnerError);

	// 3. Retire Car 1 (status = INACTIVE)
	await apiRequest('/response_info.php', {
		method: 'PUT',
		bearer: session.bearer,
		body: {
			response: {
				id: car1.response.id,
				form_id: carSetup.form.id,
				user_id: client1.id,
				identifier: plate,
				status: 'INACTIVE',
				title: car1.response.title
			},
			answers: []
		}
	});

	const defaultSearch = await apiRequest(
		'/response_info.php?form_id=' + carSetup.form.id + '&identifier=' + encodeURIComponent(plate),
		{ bearer: session.bearer }
	);
	assert.equal(Number(defaultSearch.total), 0, 'INACTIVE Object does not appear in default search');

	const explicitInactiveSearch = await apiRequest(
		'/response_info.php?form_id=' + carSetup.form.id + '&identifier=' + encodeURIComponent(plate) + '&status=INACTIVE',
		{ bearer: session.bearer }
	);
	assert.equal(Number(explicitInactiveSearch.total), 1, 'INACTIVE Object appears when status=INACTIVE is requested');

	let inactiveLinkError = null;
	try {
		await apiRequest('/order_info.php', {
			method: 'POST',
			bearer: session.bearer,
			body: {
				order: {
					billing_data_id: 1,
					cashier_user_id: session.user.id,
					client_user_id: client1.id,
					client_name: client1.name,
					currency_id: 'MXN',
					discount: 0,
					price_type_id: 1,
					service_type: 'IN_PLACE',
					status: 'PENDING',
					store_id: storeId,
					subtotal: 500,
					sync_id: 'inactivelink-' + Date.now(),
					tax: 80,
					tax_percent: 16,
					total: 580
				},
				items: [objectOrderItem(item)],
				responses: [
					{ order_response: { response_id: car1.response.id } }
				]
			}
		});
	} catch (e) {
		inactiveLinkError = e.message;
	}
	assert.ok(inactiveLinkError && /inactivo/i.test(inactiveLinkError), 'Linking INACTIVE Object to an order is rejected: ' + inactiveLinkError);
});
