const pool = require("../config/dbconfig");

const PageAccessModel = {
  getPermissions: async () => {
    try {
      const sql = `SELECT permission_id, permission_name, section, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM permissions WHERE is_active = 1 ORDER BY permission_id ASC`;
      const [result] = await pool.query(sql);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getRoles: async (name) => {
    try {
      const queryParams = [];
      let getQuery = `SELECT role_id, role_name, background_color, text_color, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM roles WHERE is_active = 1`;

      if (name) {
        getQuery += ` AND role_name LIKE '%${name}%'`;
      }

      getQuery += ` ORDER BY role_id ASC`;
      const [result] = await pool.query(getQuery, queryParams);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertRoles: async (role_name, background_color, text_color) => {
    try {
      const [isExists] = await pool.query(
        `SELECT role_id FROM roles WHERE role_name = ? AND is_active = 1`,
        [role_name]
      );
      if (isExists.length > 0) throw new Error("The role name already exists");
      const sql = `INSERT INTO roles(role_name, background_color, text_color) VALUES(?, ?, ?)`;
      const values = [role_name, background_color, text_color];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateRole: async (role_name, role_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT role_id FROM roles WHERE role_id = ? AND is_active = 1`,
        [role_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid role Id");

      const [isNameExists] = await pool.query(
        `SELECT role_id FROM roles WHERE role_name = ? AND role_id <> ?`,
        [role_name, role_id]
      );

      if (isNameExists.length > 0) throw new Error("Role name already exists");
      const sql = `UPDATE
                      roles
                  SET
                      role_name = ?
                  WHERE
                      role_id = ?`;
      const values = [role_name, role_id];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteRole: async (role_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT role_id FROM roles WHERE role_id = ? AND is_active = 1`,
        [role_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid role Id");

      const [isRoleMapped] = await pool.query(
        `SELECT COUNT(id) AS count FROM role_permissions WHERE role_id = ?`,
        [role_id]
      );
      if (isRoleMapped[0].count > 0)
        throw new Error(
          "Before delete, remove the all permissions from this role."
        );

      const [result] = await pool.query(`DELETE FROM roles WHERE role_id = ?`, [
        role_id,
      ]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getGroups: async () => {
    try {
      const sql = `SELECT
                      group_id,
                      group_name,
                      description,
                      background_color,
                      text_color,
                      CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active
                  FROM groups WHERE is_active = 1`;
      const [result] = await pool.query(sql);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertGroups: async (
    group_name,
    description,
    background_color,
    text_color
  ) => {
    try {
      const [isExists] = await pool.query(
        `SELECT group_id FROM groups WHERE group_name = ? AND is_active = 1`,
        [group_name]
      );
      if (isExists.length > 0) throw new Error("The group name already exists");
      const sql = `INSERT INTO groups(group_name, description, background_color, text_color) VALUES(?, ?, ?, ?)`;
      const values = [group_name, description, background_color, text_color];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateGroup: async (group_name, description, group_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT group_id FROM groups WHERE group_id = ? AND is_active = 1`,
        [group_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid group Id");

      const [isNameExists] = await pool.query(
        `SELECT group_id FROM groups WHERE group_name = ? AND group_id <> ?`,
        [group_name, group_id]
      );

      if (isNameExists.length > 0) throw new Error("Role name already exists");
      const sql = `UPDATE
                      groups
                  SET
                      group_name = ?,
                      description = ?
                  WHERE
                      group_id = ?`;
      const values = [group_name, description, group_id];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteGroup: async (group_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT group_id FROM groups WHERE group_id  = ? AND is_active = 1`,
        [group_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid geoup Id");

      const [isGroupMapped] = await pool.query(
        `SELECT COUNT(user_group_id) AS count FROM user_group_roles WHERE group_id = ?`,
        [group_id]
      );
      if (isGroupMapped[0].count > 0)
        throw new Error(
          "Can't be able to delete this group, kindly un-map from user_group_roles table"
        );

      const [result] = await pool.query(
        `DELETE FROM groups WHERE group_id  = ?`,
        [group_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getRolePermissions: async () => {
    try {
      const [getRoles] = await pool.query(
        `SELECT role_id, role_name FROM roles WHERE is_active = 1 ORDER BY role_id ASC`
      );

      const formattedResult = await Promise.all(
        getRoles.map(async (item) => {
          const [getPermissions] = await pool.query(
            `SELECT rp.id, rp.permission_id, p.permission_name, p.section FROM role_permissions AS rp INNER JOIN permissions AS p ON rp.permission_id = p.permission_id AND p.is_active = 1 WHERE rp.role_id = ? ORDER BY rp.id`,
            [item.role_id]
          );

          return {
            ...item,
            permissions: getPermissions,
          };
        })
      );

      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getRolePermissionsById: async (role_id) => {
    try {
      const [getRole] = await pool.query(
        `SELECT role_id, role_name FROM roles WHERE is_active = 1 AND role_id = ?`,
        [role_id]
      );

      const [getPermissions] = await pool.query(
        `SELECT rp.id, rp.permission_id, p.permission_name, p.section FROM role_permissions AS rp INNER JOIN permissions AS p ON rp.permission_id = p.permission_id AND p.is_active = 1 AND rp.role_id = ? ORDER BY rp.id`,
        [getRole[0].role_id]
      );

      return {
        ...getRole[0],
        permissions: getPermissions,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertRolePermissions: async (role_id, permission_ids) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Step 1: Get current permissions for this role
      const [currentPermissions] = await connection.query(
        `SELECT permission_id FROM role_permissions WHERE role_id = ?`,
        [role_id]
      );

      const currentPermissionIds = currentPermissions.map(
        (cp) => cp.permission_id
      );

      // Step 2: Find permissions to DELETE (exist in DB but not in new input)
      const permissionsToDelete = currentPermissionIds.filter(
        (id) => !permission_ids.includes(id)
      );

      // Step 3: Find permissions to INSERT (exist in new input but not in DB)
      const permissionsToInsert = permission_ids.filter(
        (id) => !currentPermissionIds.includes(id)
      );

      // Step 4: Delete permissions that are no longer needed
      if (permissionsToDelete.length > 0) {
        const deletePlaceholders = permissionsToDelete.map(() => "?").join(",");
        await connection.query(
          `DELETE FROM role_permissions 
                 WHERE role_id = ? AND permission_id IN (${deletePlaceholders})`,
          [role_id, ...permissionsToDelete]
        );
      }

      // Step 5: Insert new permissions
      let insertedRows = 0;
      if (permissionsToInsert.length > 0) {
        const insertPlaceholders = permissionsToInsert
          .map(() => "(?, ?)")
          .join(", ");
        const insertValues = permissionsToInsert.flatMap((permission_id) => [
          role_id,
          permission_id,
        ]);

        const [insertResult] = await connection.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ${insertPlaceholders}`,
          insertValues
        );
        insertedRows = insertResult.affectedRows;
      }

      await connection.commit();

      return {
        inserted: insertedRows,
        deleted: permissionsToDelete.length,
        unchanged: permission_ids.length - permissionsToInsert.length,
        message: `Sync completed: ${insertedRows} inserted, ${
          permissionsToDelete.length
        } deleted, ${
          permission_ids.length - permissionsToInsert.length
        } unchanged`,
      };
    } catch (error) {
      await connection.rollback();
      throw new Error(error.message);
    } finally {
      connection.release();
    }
  },

  insertUserGroup: async (group_id, users) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Validate input
      if (!group_id || !users || !Array.isArray(users)) {
        throw new Error("Invalid input: group_id and users array are required");
      }

      const userIds = users.map((u) => u.user_id);

      // Check if users exist in other groups
      if (userIds.length > 0) {
        const checkOtherGroupsQuery = `
        SELECT DISTINCT user_id 
        FROM user_group_roles 
        WHERE user_id IN (?) 
        AND group_id != ?
      `;

        const [existingInOtherGroups] = await connection.query(
          checkOtherGroupsQuery,
          [userIds, group_id]
        );

        if (existingInOtherGroups.length > 0) {
          const conflictingUsers = existingInOtherGroups
            .map((row) => row.user_id)
            .join(", ");
          throw new Error(
            `Users [${conflictingUsers}] already exist in other groups`
          );
        }
      }

      // Get current users and their roles for this group
      const getCurrentUsersQuery = `
      SELECT user_id, role_id 
      FROM user_group_roles 
      WHERE group_id = ?
    `;

      const [currentUsers] = await connection.query(getCurrentUsersQuery, [
        group_id,
      ]);

      // Remove duplicate roles from input data
      const inputUserRoles = new Map(); // user_id -> Set of role_ids
      const inputUserIds = new Set();

      for (const user of users) {
        inputUserIds.add(user.user_id);
        if (!inputUserRoles.has(user.user_id)) {
          inputUserRoles.set(user.user_id, new Set());
        }
        for (const role of user.roles) {
          inputUserRoles.get(user.user_id).add(role.role_id);
        }
      }

      // Convert current users to a map for easy lookup
      const currentUserRoles = new Map(); // user_id -> Set of role_ids
      const currentUserSet = new Set();

      currentUsers.forEach((row) => {
        currentUserSet.add(row.user_id);
        if (!currentUserRoles.has(row.user_id)) {
          currentUserRoles.set(row.user_id, new Set());
        }
        currentUserRoles.get(row.user_id).add(row.role_id);
      });

      // Find roles to INSERT (exist in input but not in current DB)
      const rolesToInsert = [];
      for (const [userId, inputRoleSet] of inputUserRoles) {
        const currentRoleSet = currentUserRoles.get(userId) || new Set();
        for (const roleId of inputRoleSet) {
          if (!currentRoleSet.has(roleId)) {
            rolesToInsert.push([userId, group_id, roleId]);
          }
        }
      }

      // Find roles to DELETE (exist in current DB but not in input)
      const rolesToDelete = [];
      for (const [userId, currentRoleSet] of currentUserRoles) {
        const inputRoleSet = inputUserRoles.get(userId) || new Set();
        for (const roleId of currentRoleSet) {
          if (!inputRoleSet.has(roleId)) {
            rolesToDelete.push([userId, roleId]);
          }
        }
      }

      // Find users to DELETE completely (exist in DB but not in input)
      const usersToDelete = Array.from(currentUserSet).filter(
        (userId) => !inputUserIds.has(userId)
      );

      // Delete roles that are no longer needed
      if (rolesToDelete.length > 0) {
        // Build OR conditions for the delete query
        const conditions = rolesToDelete
          .map(() => "(user_id = ? AND role_id = ?)")
          .join(" OR ");
        const deleteRolesQuery = `
        DELETE FROM user_group_roles 
        WHERE group_id = ? AND (${conditions})
      `;

        const deleteParams = [group_id];
        rolesToDelete.forEach(([userId, roleId]) => {
          deleteParams.push(userId, roleId);
        });

        await connection.query(deleteRolesQuery, deleteParams);
      }

      // Delete users that are not in input
      if (usersToDelete.length > 0) {
        const deleteUsersQuery = `
        DELETE FROM user_group_roles 
        WHERE group_id = ? AND user_id IN (?)
      `;
        await connection.query(deleteUsersQuery, [group_id, usersToDelete]);
      }

      // Insert new roles (using INSERT IGNORE to prevent any potential duplicates)
      if (rolesToInsert.length > 0) {
        const insertQuery = `
        INSERT IGNORE INTO user_group_roles (user_id, group_id, role_id) 
        VALUES ?
      `;
        await connection.query(insertQuery, [rolesToInsert]);
      }

      await connection.commit();

      return {
        success: true,
        message: `Group users updated successfully`,
        stats: {
          newRolesAdded: rolesToInsert.length,
          oldRolesRemoved: rolesToDelete.length,
          usersRemoved: usersToDelete.length,
          totalUsers: inputUserIds.size,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw new Error(error.message);
    } finally {
      connection.release();
    }
  },

  getUserGroupById: async (group_id) => {
    try {
      // Get group details
      const [getGroup] = await pool.query(
        `SELECT group_id, group_name FROM groups WHERE group_id = ? AND is_active = 1`,
        [group_id]
      );

      // Check if group exists
      if (getGroup.length === 0) {
        throw new Error("Group not found");
      }

      // Get all users in the group
      const [getUsers] = await pool.query(
        `SELECT ug.user_id, u.user_name 
       FROM user_group_roles AS ug 
       INNER JOIN users AS u ON ug.user_id = u.user_id 
       WHERE ug.group_id = ? AND ug.is_active = 1 
       GROUP BY ug.user_id, u.user_name`,
        [group_id]
      );

      // Get roles for all users in parallel using Promise.all
      const usersWithRoles = await Promise.all(
        getUsers.map(async (item) => {
          const [getRoles] = await pool.query(
            `SELECT ug.role_id, r.role_name 
           FROM user_group_roles AS ug 
           INNER JOIN roles AS r ON ug.role_id = r.role_id 
           WHERE ug.user_id = ? AND ug.group_id = ? AND ug.is_active = 1`,
            [item.user_id, group_id] // Added group_id to ensure we get roles only for this group
          );

          return {
            user_id: item.user_id,
            user_name: item.user_name,
            roles: getRoles,
          };
        })
      );

      return {
        group_id: getGroup[0].group_id,
        group_name: getGroup[0].group_name,
        users: usersWithRoles,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUserPermissions: async (role_ids) => {
    try {
      // Validate input
      if (!Array.isArray(role_ids) || role_ids.length === 0) {
        return [];
      }

      // Create placeholders and ensure values are numbers
      const placeholders = role_ids.map(() => "?").join(", ");
      const numericRoleIds = role_ids.map((id) => Number(id));

      const sql = `SELECT 
                        rp.role_id, 
                        r.role_name, 
                        rp.permission_id, 
                        p.permission_name 
                     FROM role_permissions AS rp 
                     INNER JOIN permissions AS p ON rp.permission_id = p.permission_id 
                     INNER JOIN roles AS r ON r.role_id = rp.role_id 
                     WHERE rp.role_id IN (${placeholders})`;

      const [permissions] = await pool.query(sql, numericRoleIds);
      return permissions;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUsersDownline: async (user_id) => {
    try {
      const getQuery = `SELECT
                            u.id,
                            u.user_id,
                            u.user_name,
                            u.child_users,
                            u.roles
                        FROM
                            users AS u
                        WHERE
                            u.user_id = ? AND u.is_active = 1`;
      const [getUser] = await pool.query(getQuery, user_id);

      // Parse the JSON data
      const childUsers = JSON.parse(getUser[0].child_users);
      const roles = JSON.parse(getUser[0].roles);

      // Extract user_ids from child_users and role_ids from roles
      const childUserIds = [
        getUser[0].user_id, // Include the current user's ID
        ...childUsers.map((child) => child.user_id), // Extract user_id from each child
      ];

      const roleIds = roles.map((role) => role.role_id); // Extract role_id from each role

      // Create downline_users as an array
      const downline_users = [
        {
          user_id: getUser[0].user_id,
          user_name: getUser[0].user_name,
        },
        ...childUsers.map((child) => ({
          user_id: child.user_id,
          user_name: child.user_name,
        })),
      ];

      return {
        ...getUser[0],
        child_users: childUserIds,
        roles: roleIds,
        downline_users: downline_users,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = PageAccessModel;
