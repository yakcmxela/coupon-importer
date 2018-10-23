const axios = require('axios');
const https = require('https');

const testShopPass = '7b2c09eb8483ed4ebe65b5dfa0729636';
const testShopKey = '58380e5630cb70b2d91ba451edf97451';
const shopifyKey = '!';
const shopifyPass = '!';

const wooKey = 'ck_ed64327c136087f01b627cfc841fc980436240a0';
const wooSecret = 'cs_ba6021f045d73571cae483254c290f2bf23a0117';
const wooAccess = `consumer_key=${wooKey}&consumer_secret=${wooSecret}`;
const instance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

let offset = 0;
let rootURL = `https://localhost/alaninu.com/wp-json/wc/v1/coupons?per_page=100`;
let url = `${rootURL}&offset=${offset}&${wooAccess}`;

let priceRules = [];
let failedImports = [];
let hasFinished = false;
let apiStatus = 0;

let returnFailedImports = (failedImports) => {
	console.log(failedImports.length);
	failedImports.forEach((rule, index) => {
		setTimeout(() => {
			axios
			.get(`https://${shopifyKey}:${shopifyPass}@alani-nu.myshopify.com/admin/price_rules/${rule.id}.json`)
			.then((data) => {
				if(data) {
					console.log('Failed import: ' + rule.code + ' rule exists.');
				} else {
					console.log('Unkown price rule error, no rule exists');
				}
			})
			.catch((err) => {
				console.log(err);
			})

			axios
			.get(`https://${shopifyKey}:${shopifyPass}@alani-nu.myshopify.com/admin/discount_codes/lookup.json?code=${rule.code}`)
			.then((data) => {
				if(data) {
					console.log('Failed import: ' + rule.code + ' discount code exists');
				} else {
					console.log('Unkown discount code error, no code exists');
				}
			})
			.catch((err) => {
				console.log(err);
			})

		}, 1200 * (index + 1));
	});
	let importedRules = null;
	
}

let runImports = (priceRules) => {
	let count = 1;
	let total = 0;
	let discountCode = null;
	console.log(priceRules.length);
	priceRules.forEach((rule, index) => {
		setTimeout(() => {
			let ruleID = '';
			axios
			.post(`https://${shopifyKey}:${shopifyPass}@alani-nu.myshopify.com/admin/price_rules.json`, rule)
			.then((response) => {
				ruleID = response.data.price_rule.id;
				discountCode = {
					'discount_code': {
						'code': rule.price_rule.title,
						'price_rule_id': ruleID,
						'usage_count': rule.price_rule.times_used
					}
				}
				axios
				.post(`https://${shopifyKey}:${shopifyPass}@alani-nu.myshopify.com/admin/price_rules/${ruleID}/discount_codes.json`, discountCode)
				.then((response) => {
					console.log(response.headers.http_x_shopify_shop_api_call_limit);
					console.log('Discount Created! (Count: ' + count + ')');
					count++;
				})
				.catch((err) => {
					let failedImport = { code: discountCode.discount_code.code, id: ruleID }
					failedImports.push(failedImport);
				})
			})
			.catch((err) => {
				console.log(err);
			});
			total++;
			console.log(total);
			if(total == priceRules.length) {
				returnFailedImports(failedImports);
			}
		}, 1200 * (index + 1));
	})
}

let runTests = (priceRules) => {
	let rulesWithFreeShipping = [];
	let rulesWithoutFreeShipping = [];
	let expiries = [];
	priceRules.forEach((rule) => {
		// if(rule.free_shipping == true) {
		// 	rulesWithFreeShipping.push(rule);
		// }
		// if(rule.free_shipping == false) {
		// 	rulesWithoutFreeShipping.push(rule);
		// }
		// if(rule.minimum_amount !== '0.00') {
		// 	console.log(rule.minimum_amount);
		// }
		// if(rule.product_categories.length > 0) {
		// 	console.log(rule.code, rule.product_categories);
		// }
		// if(rule.excluded_product_categories.length > 0) {
		// 	console.log('Code excludes product categories ' + rule.code);
		// }
		// if(rule.individual_use == true) {
		// 	console.log('Code cannot be used with others: ', rule.code);
		// }
		// if(rule.email_restrictions.length > 0) {
		// 	console.log('email restriction code: ' + rule.code);
		// }
		// if(rule.product_ids.length > 0) {
		// 	console.log('Code limited to products: ', rule.code);
		// }
		// if(rule.exclude_product_ids.length > 0) {
		// 	console.log('Product exclusions code: ', rule.code);
		// }
		// if(rule.exclude_sale_items == true) {
		// 	console.log('Code excludes sale items ' + rule.code);
		// }
		// if(rule.limit_usage_to_x_items !== null) {
		// 	console.log('Code limits usage to x items ', rule.code);
		// }
	})

	console.log(expiries.length);
}

let i = 0;
let getDiscounts = (url) => {
	if (hasFinished == true) {
		//return runTests(priceRules);
		return runImports(priceRules);
	}
	instance.get(url)
	.then((data) => {
		if(data.data.length < 100) { hasFinished = true }
		offset = offset + 100;
		url = `${rootURL}&offset=${offset}&${wooAccess}`;
		data.data.forEach((obj) => {
			let expiry = new Date(obj.expiry_date).getTime();
			let currentTime = new Date().getTime();
			if(expiry > currentTime || expiry == 0 && parseFloat(obj.amount) > 0) {
				let valueType = 'percentage';
				let oncePerCustomer = false;
				if(obj.discount_type == 'fixed_cart') {
					valueType = 'fixed_amount'
				}
				if(obj.usage_limit_per_user == 1) {
					oncePerCustomer = true;
				}
				let priceRule = {
					'price_rule': {
						'title': obj.code,
						'target_type': 'line_item',
						'target_selection': 'all',
						'allocation_method': 'across',
						'value_type': valueType,
						'value': '-' + obj.amount,
						'customer_selection': 'all',
						'starts_at': obj.date_created,
						'ends_at': obj.expiry_date,
						'usage_limit': obj.usage_limit,
						'times_used': obj.usage_count
					}
				}
				priceRules.push(priceRule);
			}
		});
	})
	.catch((err) => {
		console.log(err);
		return;
	})
	.then(() => {
		getDiscounts(url);
		i++;
	})
}
let req = getDiscounts(url);