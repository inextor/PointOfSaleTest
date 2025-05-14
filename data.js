
console.log('FOOOOOOOOOOOOOOOOOOOO V2.0');

function getOrderItemWithPrimes(item_ids)
{
	let obj	= {
		"order": { "billing_data_id": 1, "cashier_user_id": 1, "client_name": "PÚBLICO GRAL 01:13",
				"currency_id": "MXN",	 
				"marked_for_billing": null, "note": null, "paid_status": null, "paid_timetamp": null, "price_type_id": 1,
				"service_type": "QUICK_SALE", "status": "PENDING", "store_id": 1, 
				"sync_id": "1-"+Date.now(),
				//"subtotal": 1378.867, "tax": 1.1030936, "tax_percent": 8, "total": 1379.9700936, "discount": 0,
				"subtotal": 0, "tax": 0, "tax_percent": 8, "total": 0, "discount": 0,
		},
		"items": [ ]
	};


	obj.items.push
	({
		"order_item": 
		{
			"item_id": item_ids[0],
			"delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "NO", "delivered_qty": 0,
			"status": "ACTIVE", "commanda_status": "NOT_DISPLAYED",	"item_group": 1648973534561,
			"return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "note": "", "qty": 3, "item_option_qty": 1,
			"paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 15.5, "subtotal": 46.5, "discount": 0, "tax": 3.72,
			"total": 50.22, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26"
		}
	});

	if( item_ids.length-1 >1)
	{
		obj.items.push
		({
			"order_item": 
			{
				"item_id": item_ids[1], "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "NO", "delivered_qty": 0, 
				"status": "ACTIVE", "commanda_status": "NOT_DISPLAYED",	"item_group": 1648973535132, "return_required": "NO",
				"is_item_extra": "NO", "is_free_of_charge": "NO", "qty": 7, "item_option_qty": 1, "paid_qty": 0,
				"original_unitary_price": 15.5, "unitary_price": 15.5, "subtotal": 108.5, "discount": 0, "tax": 8.68, "total": 117.18,
				"preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26"
			}
		});
	}

	if( item_ids.length-1 > 2 )
	{

		obj.items.push
		({
			"order_item": 
			{
				"item_id": item_ids[2], "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "NO", 
				"delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED",	"item_group": 1648973535844,
				"return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "qty": 9, "item_option_qty": 1, "paid_qty": 0,
				"original_unitary_price": 15.5, "unitary_price": 15.5, "subtotal": 139.5, "discount": 0, "tax": 11.16, "total": 150.66,
				"preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26"
			}
		});
	}
	if( item_ids.length-1 > 3 )
	{
		obj.items.push
		({
			"order_item": 
			{
				"item_id": item_ids[3], "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "YES",
				"delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED", "item_group": 1648973536668, 
				"return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "qty": 11,
				"item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 14.3518182, "subtotal": 157.87,
				"discount": 0, "tax": 12.63, "total": 170.5, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26",
				"updated": "2022-04-03 08:13:26"
			},
		 });
	}

	if( item_ids.length-1 > 4 )
	{
		obj.items.push
		({
			"order_item": 
			{
				"delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "YES",
				"delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED", "item_id": item_ids[4],
				"item_group": 1648973537168, "return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "note": "",
				"price_id": null, "qty": 17, "item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5,
				"unitary_price": 14.3517647, "subtotal": 243.98, "discount": 0, "tax": 19.52, "total": 263.5,
				"preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26"
			}
		});
	}

	if( item_ids.length-1 > 5 )
	{
		obj.items.push
		({
			"order_item": 
			{
				"item_id": item_ids[5], "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "NO", 
				"delivered_qty": 0, "status": "ACTIVE", "commanda_status": "NOT_DISPLAYED",	"item_group": 1648973538050, 
				"return_required": "NO", "is_item_extra": "NO", "is_free_of_charge": "NO", "note": "", "qty": 19, 
				"item_option_qty": 1, "paid_qty": 0, "original_unitary_price": 15.5, "unitary_price": 15.5, "subtotal": 294.5, 
				"discount": 0, "tax": 23.56, "total": 318.06, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26"
			},
		 });
	}

	if( item_ids.length-1 > 6 )
	{
		obj.items.push
		({
			"order_item": 
			{
				"item_id": item_ids[6], "delivery_status": "PENDING", "stock_status": "IN_STOCK", "tax_included": "YES", "delivered_qty": 0, 
				"status": "ACTIVE",
				"commanda_status": "NOT_DISPLAYED",	"item_group": 1648973585123, "return_required": "NO",
				"is_item_extra": "NO", "is_free_of_charge": "NO", "qty": 23, "item_option_qty": 1, "paid_qty": 0,
				"original_unitary_price": 15.5, "unitary_price": 14.3517391, "subtotal": 330.09, "discount": 0, "tax": 26.41,
				"total": 356.5, "preparation_status": "PENDING", "created": "2022-04-03 08:13:26", "updated": "2022-04-03 08:13:26"
			}
		});
	}
	return obj;
}

function getPaymentSimple(order_id,total)
{
	let payment_amount = total;
	let received_amount = total;

	return {
		"movements": [
			{
				"bank_movement": {
					"transaction_type": "CASH",
					"client_user_id": null,
					"total": total,
					"amount_received": total,
					"currency_id": "MXN",
					"type": "income"
				},
				"bank_movement_orders": [
					{
						"currency_amount": total,
						"amount": total,
						"currency_id": "MXN",
						"exchange_rate": 1,
						"order_id": order_id 
					}
				]
			}
		],
		"payment": {
			"type": "income",
			"tag": "SALE",
			"payment_amount": payment_amount,
			"received_amount": received_amount,
			"change_amount": 0,
			"currency_id": "MXN",
			"sync_id": "1-"+Date.now()
		}
	}
}
