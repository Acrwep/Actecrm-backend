const pool = require("../config/dbconfig");

const PageAccessModel = {
  getPermissions: async () => {
    try {
      const sql = `SELECT permission_id, permission_name, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM permissions WHERE is_active = 1 ORDER BY permission_id ASC`;
      const [result] = await pool.query(sql);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getRoles: async () => {
    try {
      const sql = `SELECT role_id, role_name, background_color, text_color, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM roles WHERE is_active = 1 ORDER BY role_id ASC`;
      const [result] = await pool.query(sql);
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
          "Can't be able to delete this role, kindly un-map from role_permissions table"
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
            `SELECT rp.id, rp.permission_id, p.permission_name FROM role_permissions AS rp INNER JOIN permissions AS p ON rp.permission_id = p.permission_id AND p.is_active = 1 WHERE rp.role_id = ? ORDER BY rp.id`,
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
        `SELECT rp.id, rp.permission_id, p.permission_name FROM role_permissions AS rp INNER JOIN permissions AS p ON rp.permission_id = p.permission_id AND p.is_active = 1 AND rp.role_id = ? ORDER BY rp.id`,
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

  // insertRolePermissions: async (role_id, permission_ids) => {
  //   try {
  //     // Check if any permissions already exist
  //     const placeholders = permission_ids.map(() => "?").join(",");
  //     const [existingPermissions] = await pool.query(
  //       `SELECT permission_id FROM role_permissions
  //            WHERE role_id = ? AND permission_id IN (${placeholders})`,
  //       [role_id, ...permission_ids]
  //     );

  //     if (existingPermissions.length > 0) {
  //       const existingIds = existingPermissions.map((ep) => ep.permission_id);
  //       throw new Error(
  //         `Permissions [${existingIds.join(
  //           ", "
  //         )}] are already mapped to this role`
  //       );
  //     }

  //     // Create multiple value placeholders
  //     const valuePlaceholders = permission_ids.map(() => "(?, ?)").join(", ");

  //     // Flatten the values array [role_id, permission1, role_id, permission2, ...]
  //     const values = permission_ids.flatMap((permission_id) => [
  //       role_id,
  //       permission_id,
  //     ]);

  //     const sql = `INSERT INTO role_permissions (role_id, permission_id) VALUES ${valuePlaceholders}`;
  //     const [result] = await pool.query(sql, values);

  //     return result.affectedRows;
  //   } catch (error) {
  //     throw new Error(error.message);
  //   }
  // },

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
};

module.exports = PageAccessModel;
