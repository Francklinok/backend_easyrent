

/**
 * Vérifier si l'utilisateur a la permission requise
 */
export interface PermissionModel {
  action: string;
  resource: string;
  // optional fields can be added here (e.g., scope, conditions, expiresAt)
}

/**
 * Vérifier si l'utilisateur a la permission requise
 */
export async function checkUserPermission(
  userId: string, 
  action: string, 
  resource: string
): Promise<boolean> {
  // Exemple d'implémentation - à remplacer par votre logique
  // Ceci pourrait interroger une base de données ou un service RBAC externe
  
  // Note: Implémentation fictive, à adapter avec votre modèle de données
  const userPermissions = await getUserPermissionsFromDb(userId);
  
  // Vérifier les permissions directes
  const directPermission = userPermissions.some(p => 
    p.action === action && p.resource === resource
  );
  
  if (directPermission) return true;
  
  // Vérifier les permissions avec wildcard
  const wildcardPermission = userPermissions.some(p => 
    (p.action === '*' || p.action === action) && 
    (p.resource === '*' || p.resource === resource)
  );
  
  return wildcardPermission;
}

/**
 * Récupérer les permissions d'un utilisateur depuis la base de données
 */
export async function getUserPermissionsFromDb(userId: string): Promise<PermissionModel[]> {
  try {
    const User = (await import('../../users/models/userModel')).default;
    const user = await User.findById(userId).select('role');
    
    if (!user) return [];
    
    // Permissions basées sur les rôles
    const rolePermissions: Record<string, PermissionModel[]> = {
      super_admin: [{ action: '*', resource: '*' }],
      admin: [
        { action: '*', resource: 'users' },
        { action: '*', resource: 'properties' },
        { action: 'read', resource: '*' }
      ],
      agent: [
        { action: 'create', resource: 'properties' },
        { action: 'update', resource: 'properties' },
        { action: 'read', resource: 'properties' }
      ],
      client: [
        { action: 'read', resource: 'properties' },
        { action: 'create', resource: 'bookings' }
      ]
    };
    
    return rolePermissions[user.role] || [];
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
}
