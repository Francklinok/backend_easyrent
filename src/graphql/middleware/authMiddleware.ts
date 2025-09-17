import { AuthenticationError, ForbiddenError } from 'apollo-server-express';
import { AuthService } from '../../users/services/authService';
import { UserService } from '../../users/services/userService';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('GraphQLAuth');
const authService = new AuthService(new UserService());

export interface GraphQLContext {
  user?: {
    userId: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  };
  req: any;
  res: any;
}

export const createGraphQLContext = async ({ req, res }): Promise<GraphQLContext> => {
  const context: GraphQLContext = { req, res };
  
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token) {
        const decoded = authService.validateToken(token);
        
        if (decoded && decoded.userId) {
          const user = await authService['userService'].getUserById(decoded.userId);
          
          if (user && user.isActive) {
            context.user = {
              userId: user._id?.toString(),
              email: user.email,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              isActive: user.isActive
            };
            
            logger.info('GraphQL Authentication successful', {
              userId: user._id?.toString(),
              email: user.email?.substring(0, 5) + '***'
            });
          }
        }
      }
    }
  } catch (error) {
    logger.error('GraphQL Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  return context;
};

export const requireAuth = (context: GraphQLContext) => {
  if (!context.user) {
    throw new AuthenticationError('Authentication required');
  }
  return context.user;
};

export const requireRole = (context: GraphQLContext, allowedRoles: string[]) => {
  const user = requireAuth(context);
  
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }
  
  return user;
};

export const requireOwnership = async (context: GraphQLContext, resourceOwnerId: string) => {
  const user = requireAuth(context);
  
  if (user.userId !== resourceOwnerId && user.role !== 'ADMIN') {
    throw new ForbiddenError('Access denied. You can only access your own resources.');
  }
  
  return user;
};