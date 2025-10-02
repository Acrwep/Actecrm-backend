const pool = require("../config/dbconfig");

const LoginModel = {
  login: async (user_id, password) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id, user_id, password FROM users WHERE user_id = ? AND password = ? AND is_active = 1`,
        [user_id, password]
      );
      if (isExists.length <= 0) throw new Error("Invalid user Id or password");

      const getQuery = `SELECT
                            u.id,
                            u.user_id,
                            u.user_name,
                            u.child_users,
                            u.roles
                        FROM
                            users AS u
                        WHERE
                            u.id = ? AND u.is_active = 1`;
      const [getUser] = await pool.query(getQuery, [isExists[0].id]);

      // Parse the JSON data
      const childUsers = JSON.parse(getUser[0].child_users);
      const roles = JSON.parse(getUser[0].roles);

      // Extract user_ids from child_users and role_ids from roles
      const childUserIds = [
        getUser[0].user_id, // Include the current user's ID
        ...childUsers.map((child) => child.user_id), // Extract user_id from each child
      ];

      const roleIds = roles.map((role) => role.role_id); // Extract role_id from each role

      return {
        ...getUser[0],
        child_users: childUserIds,
        roles: roleIds,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = LoginModel;
