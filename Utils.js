let end_point = 'http://127.0.0.1/PointOfSale'
let referrer = 'http://127.0.0.1';

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
		"referrer": end_point,
		"referrerPolicy": "strict-origin-when-cross-origin",
		"method": "GET",
		"mode": "cors",
		"credentials": "omit"
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
	}).then((data)=>
	{
		return data.result.session.id;
	});
}

function getItem(bearer,stock_type, qty, store_id)
{
	if( stock_type == undefined )
		stock_type = 'ALWAYS';

	return doPost('/item_info.php',
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
		},bearer
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
				console.log("termino, asi que veremos que fallo");
				return response.result.item.id;
			})
			.catch((error)=>{

				console.log('Fallo la actualizar el inventario', error);
				throw error;
			});
		}

		return response.result.item.id;
	});
}

function hasPassword(obj)
{
	return false;
}
