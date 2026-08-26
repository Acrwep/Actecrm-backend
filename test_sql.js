const CustomerModel = require("./models/CustomerModel");

// Mock the pool to just print the query
const pool = require("./config/dbconfig");
pool.query = async (query, params) => {
  console.log("-----------------------------------------");
  console.log("QUERY:");
  console.log(query);
  console.log("PARAMS:");
  console.log(params);
  console.log("-----------------------------------------");
  return [[{ total: 1 }], []]; // mock count and empty result
};

async function test() {
  try {
    const from_date = "2026-08-15";
    const to_date = "2026-08-21";
    const status = undefined;
    const name = undefined;
    const email = undefined;
    const mobile = "6374965189";
    const course = undefined;
    const user_ids = ["DEV2119", "HUB5005", "HUB8014", "HUB8011", "HUB8005", "HUB8004", "HUB8007", "HUB8009", "HUB8016"];
    const page = 1;
    const limit = 10;
    const region = undefined;
    const date_type = "Updated";
    const domain = undefined;

    await CustomerModel.getCustomersV1(
      from_date,
      to_date,
      status,
      name,
      email,
      mobile,
      course,
      user_ids,
      page,
      limit,
      region,
      date_type,
      domain
    );
  } catch (err) {
    console.error(err);
  }
}

test();
