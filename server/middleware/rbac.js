// Role-Based Access Control (RBAC) Middleware

// Role hierarchy: admin > editor > viewer
const roleHierarchy = {
    viewer: 1,
    editor: 2,
    admin: 3
};

// Permission definitions
const permissions = {
    // Video permissions
    'video:upload': ['editor', 'admin'],
    'video:read': ['viewer', 'editor', 'admin'],
    'video:update': ['editor', 'admin'],
    'video:delete': ['editor', 'admin'],
    'video:read:all': ['admin'],

    // User management permissions
    'user:read': ['admin'],
    'user:create': ['admin'],
    'user:update': ['admin'],
    'user:delete': ['admin'],

    // System permissions
    'system:settings': ['admin'],
    'system:stats': ['admin']
};

// Check if user has required role
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const userRole = req.user.role;

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

// Check if user has required permission
export const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const userRole = req.user.role;
        const allowedRoles = permissions[permission] || [];

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Permission denied: ${permission}`
            });
        }

        next();
    };
};

// Check if user has minimum role level
export const requireMinRole = (minRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const userRoleLevel = roleHierarchy[req.user.role] || 0;
        const requiredRoleLevel = roleHierarchy[minRole] || 0;

        if (userRoleLevel < requiredRoleLevel) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient role level'
            });
        }

        next();
    };
};

// Check if user is owner or has admin role
export const requireOwnerOrAdmin = (getOwnerId) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Admin can access anything
        if (req.user.role === 'admin') {
            return next();
        }

        try {
            const ownerId = await getOwnerId(req);

            if (!ownerId) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }

            if (ownerId.toString() === req.user._id.toString()) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        } catch (error) {
            console.error('Owner check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authorization error'
            });
        }
    };
};

// Same organization check
export const requireSameOrganization = (getOrganization) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        try {
            const resourceOrg = await getOrganization(req);

            if (!resourceOrg) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }

            if (resourceOrg !== req.user.organization) {
                return res.status(403).json({
                    success: false,
                    message: 'Cross-organization access denied'
                });
            }

            next();
        } catch (error) {
            console.error('Organization check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authorization error'
            });
        }
    };
};

// Helper function to check if user has permission
export const hasPermission = (userRole, permission) => {
    const allowedRoles = permissions[permission] || [];
    return allowedRoles.includes(userRole);
};

// Helper function to check role level
export const hasMinRole = (userRole, minRole) => {
    const userRoleLevel = roleHierarchy[userRole] || 0;
    const requiredRoleLevel = roleHierarchy[minRole] || 0;
    return userRoleLevel >= requiredRoleLevel;
};

export default {
    requireRole,
    requirePermission,
    requireMinRole,
    requireOwnerOrAdmin,
    requireSameOrganization,
    hasPermission,
    hasMinRole
};
