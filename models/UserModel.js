const pool = require("../config/dbconfig");

const UserModel = {
  addUser: async (
    user_id,
    user_name,
    password,
    users,
    roles,
    target_value,
    target_start,
    target_end
  ) => {
    try {
      let affectedRows = 0;
      const [isUserIdExists] = await pool.query(
        `SELECT id FROM users WHERE user_id = ? AND is_active = 1`,
        [user_id]
      );
      if (isUserIdExists.length > 0) {
        throw new Error("User Id already exists");
      }
      const insertQuery = `INSERT INTO users(
                              user_id,
                              user_name,
                              password,
                              child_users,
                              roles
                          )
                          VALUES(?, ?, ?, ?, ?)`;
      const values = [
        user_id,
        user_name,
        password,
        JSON.stringify(users),
        JSON.stringify(roles),
      ];

      const [result] = await pool.query(insertQuery, values);
      affectedRows += result.affectedRows;

      const [isTargetExists] = await pool.query(
        `SELECT * FROM user_target_master WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
        [target_start, target_end, user_id]
      );

      if (isTargetExists.length > 0) {
        const [updateTarget] = await pool.query(
          `UPDATE user_target_master SET target_value = ? WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
          [target_value, target_start, target_end, user_id]
        );
        affectedRows += updateTarget.affectedRows;
      } else {
        const [insertTarget] = await pool.query(
          `INSERT INTO user_target_master(user_id, target_month, target_value) VALUES(?, CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')), ?)`,
          [user_id, target_start, target_end, target_value]
        );
        affectedRows += insertTarget.affectedRows;
      }

      if (users.length > 0) {
        for (const child of users) {
          // Check if child user exists
          const [childExists] = await pool.query(
            `SELECT id FROM users WHERE user_id = ?`,
            [child.user_id]
          );

          if (childExists.length === 0) {
            // Create child user if doesn't exist
            await pool.query(
              `INSERT INTO users(user_id, user_name, password, roles) VALUES(?, ?, ?, ?)`,
              [child.user_id, child.user_name, "", "[]"]
            );
            affectedRows += 1;
          }

          // 3. Check if parent-child relationship already exists
          const [relationshipExists] = await pool.query(
            `SELECT id FROM users_downline WHERE user_id = ? AND parent_id = ?`,
            [child.user_id, user_id]
          );

          if (relationshipExists.length === 0) {
            // Create parent-child relationship
            await pool.query(
              `INSERT INTO users_downline(user_id, parent_id) VALUES(?, ?)`,
              [child.user_id, user_id]
            );
            affectedRows += 1;
          }

          // 4. Update paths for this parent-child relationship
          await updatePathsForParentChild(child.user_id, user_id);
        }
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUsers: async (user_id, user_name, page, limit) => {
    try {
      const params = [];
      let getQuery = `SELECT id, user_id, user_name, password, child_users, roles, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM users WHERE is_active = 1`;

      let countQuery = `SELECT COUNT(id) AS total FROM users WHERE is_active = 1`;
      if (user_id) {
        getQuery += ` AND user_id LIKE '%${user_id}%'`;
        countQuery += ` AND user_id LIKE '%${user_id}%'`;
      }
      if (user_name) {
        getQuery += ` AND user_name LIKE '%${user_name}%'`;
        countQuery += ` AND user_name LIKE '%${user_name}%'`;
      }

      const [countResult] = await pool.query(countQuery);
      const total = countResult[0].total || 0;

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      getQuery += ` ORDER BY user_name`;

      getQuery += ` LIMIT ? OFFSET ?`;
      params.push(limitNumber, offset);

      const [users] = await pool.query(getQuery, params);

      // Get all users
      const [getAllUsers] = await pool.query(
        `SELECT id, user_id, user_name FROM users WHERE is_active = 1`
      );

      const formattedResult = await Promise.all(
        users.map(async (item) => {
          const [getTarget] = await pool.query(
            `SELECT id AS user_target_id, target_month, target_value FROM user_target_master WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
            [item.user_id]
          );

          child_users = JSON.parse(item.child_users);
          return {
            ...item,
            user_target_id: getTarget[0]?.user_target_id || 0,
            target_month: getTarget[0]?.target_month || "",
            target_value: getTarget[0]?.target_value || 0,
            child_users: child_users.map((child) => ({
              user_id: child.user_id,
              user_name:
                getAllUsers.find((r) => r.user_id === child.user_id)
                  ?.user_name || "",
            })),
            roles: JSON.parse(item.roles),
          };
        })
      );

      return {
        data: formattedResult,
        pagination: {
          total: parseInt(total),
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber),
        },
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateUser: async (
    id,
    user_id,
    user_name,
    password,
    users,
    roles,
    target_start,
    target_end,
    target_value
  ) => {
    try {
      let affectedRows = 0;
      const [isIdExists] = await pool.query(
        `SELECT id FROM users WHERE id = ?`,
        [id]
      );
      if (isIdExists.length <= 0) {
        throw new Error("Invalid Id");
      }
      const updateQuery = `UPDATE users SET user_id = ?, user_name = ?, password = ?, child_users = ?, roles = ? WHERE id = ?`;
      const values = [
        user_id,
        user_name,
        password,
        JSON.stringify(users),
        JSON.stringify(roles),
        id,
      ];
      const [result] = await pool.query(updateQuery, values);

      affectedRows += result.affectedRows;

      const [isTargetExists] = await pool.query(
        `SELECT * FROM user_target_master WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
        [target_start, target_end, user_id]
      );

      if (isTargetExists.length > 0) {
        const [updateTarget] = await pool.query(
          `UPDATE user_target_master SET target_value = ? WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
          [target_value, target_start, target_end, user_id]
        );
        affectedRows += updateTarget.affectedRows;
      } else {
        const [insertTarget] = await pool.query(
          `INSERT INTO user_target_master(user_id, target_month, target_value) VALUES(?, CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')), ?)`,
          [user_id, target_start, target_end, target_value]
        );
        affectedRows += insertTarget.affectedRows;
      }

      if (users.length > 0) {
        const [deleteDownline] = await pool.query(
          `DELETE FROM users_downline WHERE parent_id = ?`,
          [user_id]
        );
        affectedRows += deleteDownline.affectedRows;
        const [deleteDownlinePath] = await pool.query(
          `DELETE FROM user_downline_paths WHERE parent_id = ?`,
          [user_id]
        );
        affectedRows += deleteDownlinePath.affectedRows;
        for (const child of users) {
          // Check if child user exists
          const [childExists] = await pool.query(
            `SELECT id FROM users WHERE user_id = ?`,
            [child.user_id]
          );

          if (childExists.length === 0) {
            // Create child user if doesn't exist
            await pool.query(
              `INSERT INTO users(user_id, user_name, password, roles) VALUES(?, ?, ?, ?)`,
              [child.user_id, child.user_name, "", "[]"]
            );
            affectedRows += 1;
          }

          // 3. Check if parent-child relationship already exists
          const [relationshipExists] = await pool.query(
            `SELECT id FROM users_downline WHERE user_id = ? AND parent_id = ?`,
            [child.user_id, user_id]
          );

          if (relationshipExists.length === 0) {
            // Create parent-child relationship
            await pool.query(
              `INSERT INTO users_downline(user_id, parent_id) VALUES(?, ?)`,
              [child.user_id, user_id]
            );
            affectedRows += 1;
          }

          // 4. Update paths for this parent-child relationship
          await updatePathsForParentChild(child.user_id, user_id);
        }
      } else if (users.length === 0) {
        const [deleteDownline] = await pool.query(
          `DELETE FROM users_downline WHERE parent_id = ?`,
          [user_id]
        );
        affectedRows += deleteDownline.affectedRows;
        const [deleteDownlinePath] = await pool.query(
          `DELETE FROM user_downline_paths WHERE parent_id = ?`,
          [user_id]
        );
        affectedRows += deleteDownlinePath.affectedRows;
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  setTarget: async (user_ids, target_start, target_end, target_value) => {
    try {
      let affectedRows = 0;
      if (user_ids.length > 0 && Array.isArray(user_ids)) {
        await Promise.all(
          user_ids.map(async (item) => {
            const [isTargetExists] = await pool.query(
              `SELECT * FROM user_target_master WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
              [target_start, target_end, item.user_id]
            );

            if (isTargetExists.length > 0) {
              const [updateTarget] = await pool.query(
                `UPDATE user_target_master SET target_value = ? WHERE target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) AND user_id = ?`,
                [target_value, target_start, target_end, item.user_id]
              );
              affectedRows += updateTarget.affectedRows;
            } else {
              const [insertTarget] = await pool.query(
                `INSERT INTO user_target_master(user_id, target_month, target_value) VALUES(?, CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')), ?)`,
                [item.user_id, target_start, target_end, target_value]
              );
              affectedRows += insertTarget.affectedRows;
            }
          })
        );
      }

      return affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getAllDownlines: async (user_id) => {
    try {
      const getQuery = `WITH user_hierarchy AS (
                          SELECT u.user_id, u.user_name FROM users AS u WHERE u.user_id = ?
                            UNION ALL
                            SELECT udp.user_id, u.user_name FROM user_downline_paths AS udp INNER JOIN users AS u ON udp.user_id = u.user_id WHERE udp.ancestor_id = ?
                        )
                        SELECT * FROM user_hierarchy GROUP BY user_id, user_name ORDER BY user_id;`;

      const [result] = await pool.query(getQuery, [user_id, user_id]);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

const updatePathsForParentChild = async (childUserId, parentId) => {
  // First, remove any existing paths for this parent-child line to avoid duplicates
  await pool.query(
    `DELETE FROM user_downline_paths WHERE user_id = ? AND parent_id = ?`,
    [childUserId, parentId]
  );

  // 1. Insert self-path for child under this parent
  await pool.query(
    `INSERT INTO user_downline_paths(user_id, ancestor_id, parent_id, depth) VALUES(?, ?, ?, 0)`,
    [childUserId, childUserId, parentId]
  );

  // 2. Insert path: child -> parent (depth 1)
  await pool.query(
    `INSERT INTO user_downline_paths(user_id, ancestor_id, parent_id, depth) VALUES(?, ?, ?, 1)`,
    [childUserId, parentId, parentId]
  );

  // 3. Get all existing ancestors of the parent for this specific parent line
  const [parentAncestors] = await pool.query(
    `SELECT ancestor_id, depth FROM user_downline_paths WHERE user_id = ? AND parent_id = ? AND ancestor_id != user_id`,
    [parentId, parentId]
  );

  // 4. Copy all parent's ancestors to child with increased depth
  for (const ancestor of parentAncestors) {
    await pool.query(
      `INSERT INTO user_downline_paths(user_id, ancestor_id, parent_id, depth) VALUES(?, ?, ?, ?)`,
      [childUserId, ancestor.ancestor_id, parentId, ancestor.depth + 1]
    );
  }

  // 5. Recursively update all descendants of this child for this parent line
  await updateDescendantsForNewParent(childUserId, parentId);
};

const updateDescendantsForNewParent = async (userId, newParentId) => {
  // Get all direct children of this user
  const [directChildren] = await pool.query(
    `SELECT user_id FROM users_downline WHERE parent_id = ?`,
    [userId]
  );

  for (const child of directChildren) {
    // Update paths for this child under the new parent line
    await updatePathsForParentChild(child.user_id, newParentId);
  }
};

module.exports = UserModel;
