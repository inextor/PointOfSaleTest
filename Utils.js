let end_point = 'https://test.integranet.xyz/api'
//let referrer = 'http://test.integranet.xyz';

function doGet(path,bearer)
{
	let headers =  {
	   "accept": "application/json, text/plain, */*",
	   "content-type": "application/json",
	 }

	if( bearer )
	{
		headers['Authorization'] = 'Bearer ' + bearer;
	}

	return fetch(end_point+path, {
		"headers": headers,
	//	"referrer": end_point,
		"referrerPolicy": "strict-origin-when-cross-origin",
		"method": "GET",
		"mode": "cors",
		"credentials": "include"
	})
	.then((r)=>
	{
		if( r.status >= 200 && r.status < 300 )
		{
			return r.json();
		}
		else
		{
			return r.json().then(e=>{
				throw e;
			});
		}
	})
	.then((response)=>{
		return { result: response, bearer: bearer }
	});
}

function getNewClientP(bearer)
{
	let client = {
		"birthday": null,
		"created": null,
		"created_by_store_id": null,
		"created_by_user_id": 2,
		"creation_store_id": "1",
		"credit_days": 0,
		"credit_limit": 0,
		"default_billing_address_id": null,
		"default_shipping_address_id": null,
		"id": 0,
		"image_id": null,
		"lat": null,
		"lng": null,
		"name": "ClienteXXXXXXXX",
		"payment_address_id": null,
		"payment_option": "STORE",
		"platform_client_id": null,
		"points": 0,
		"preferred_store_id": null,
		"price_type_id": "1",
		"production_area_id": null,
		"status": "ACTIVE",
		"store_id": null,
		"type": "CLIENT",
		"updated": null,
		"updated_by_user_id": null,
		"workshift_id": null
	};

	return doPost('/user.php', client, bearer);
}

function getNewAdressP(client_id,bearer)
{
	console.log('Creando nueva address');
	let address = {
		"name": "Carlos Collado EDITADO",
		"sat_regimen_capital": "",
		"sat_regimen_fiscal": "",
		"type": "SHIPPING",
		"address": "asdfasdf",
		"zipcode": "22800",
		"email": "",
		"rfc": "",
		"user_id": client_id,
		"lat": 31.86053689098042,
		"lng": -116.60505248383286
	};

	return doPost('/address.php', address, bearer );
}

function doPost(path, body, bearer)
{
	let headers =  {
	   "accept": "application/json, text/plain, */*",
	   "content-type": "application/json",
	 }

	if( bearer )
	{
		headers['Authorization'] = 'Bearer ' + bearer;
	}

	return fetch(end_point+path, {
		"headers": headers,
		"referrer": end_point,
		"referrerPolicy": "strict-origin-when-cross-origin",
		"body": JSON.stringify(body),
		"method": "POST",
		"mode": "cors",
		"credentials": "omit"
	})
	.then((r)=>
	{
		if( r.status >= 200 && r.status < 300 )
		{
			let size = r.headers.get('content-length');
			if( size > 0 )
				return r.json();
			else
				return Promise.resolve({});
		}
		else
		{
			return r.json().then(e=>{
				throw e;
			});
		}
	})
	.then((response)=>{
		return { result: response, bearer: bearer }
	});
}

function login(user_type)
{
	let user = 'admin';

	if( user_type == 'admin' )
	{
		user = 'admin';
	}
	else if( user_type == 'cashier' )
	{
		user = 'admin';
	}
	else if( user_type == 'cashier' )
	{
		user = 'admin';
	}

	return doPost('/login.php',
	{
		"username": "admin",
		"password": "asdf"
	})
	.then((data)=>
	{
		console.log('LOGIN HEEEEEEEE');
		return data.result.session.id;
	});
}

function getItem(bearer,stock_type, qty, store_id)
{
	if( stock_type == undefined )
		stock_type = 'ALWAYS';

	return doPost
	(
		'/item_info.php',
		{
			"item":
			{
				"availability_type": stock_type,
				"clave_sat": "53111603",
				"name": "Item Test "+Date.now(),
				"note_required": "NO",
				"on_sale": "NO",
				"reference_price": 0,
				"status": "ACTIVE",
				"unidad_medida_sat_id": "H87",
			},
		},
		bearer
	)
	.then((response)=>
	{
		if( stock_type == 'ON_STOCK' && qty !== undefined )
		{
			console.log('Agregando stock');
			let object = {
				"method":"adjustStock",
				"stock_records":[{
					"store_id": store_id,
					"qty": 6,
					"item_id": response.result.item.id,
				}]
			};

			console.log("Funciona todavia aqui");

			return doPost('/updates.php', object, bearer)
			.then((_response)=>
			{
				return response.result.item.id;
			})
			.then((fooo)=>{
				assert.ok(true,'TOOO bien');
			})
			//.catch((error)=>{

			//	console.log('Fallo la actualizar el inventario', error);
			//	throw error;
			//});
		}

		return response.result.item.id;
	});
}

function promiseObject(obj)
{
	const keys = Object.keys(obj);
	const promises = keys.map((key) =>
	{
		if( obj[key] instanceof Promise )
			return obj[key];

		return Promise.resolve(obj[key])
	});

	return Promise.all(promises).then(values =>
	{
		const result = {};
		for (let i = 0; i < values.length; i++)
		{
			result[keys[i]] = values[i];
		}
		return result;
	});
}

function hasPassword(obj)
{
	return false;
}
