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
		"headers": {
			"accept": "application/json, text/plain, */*",
			"content-type": "application/json",
		},
		"referrer": end_point,
		"referrerPolicy": "strict-origin-when-cross-origin",
		"method": "GET",
		"mode": "cors",
		"credentials": "omit"
	}).then(r=>r.json());
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
		console.log('Returns', r );
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

function getItem(bearer)
{
	return doPost('/item_info.php',
		{
			"item": 
			{
				"availability_type": "ALWAYS",
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
		return response.result.item.id;
	});
}

function hasPassword(obj)
{
	return false;
}


