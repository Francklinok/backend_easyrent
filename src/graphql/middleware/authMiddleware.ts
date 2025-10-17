import { GraphQLError } from 'graphql';
import { AuthService } from '../../users/services/authService';
import { UserService } from '../../users/services/userService';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('GraphQLAuth');
let authService: AuthService | null = null;

const getAuthService = () => {
  if (!authService) {
    authService = new AuthService(new UserService());
  }
  return authService;
};

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
        const service = getAuthService();
        const decoded = service.validateToken(token);
        
        if (decoded && decoded.userId) {
          const user = await service['userService'].getUserById(decoded.userId);
          
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
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' }
    });
  }
  return context.user;
};

export const requireRole = (context: GraphQLContext, allowedRoles: string[]) => {
  const user = requireAuth(context);

  if (!allowedRoles.includes(user.role)) {
    throw new GraphQLError(`Access denied. Required roles: ${allowedRoles.join(', ')}`, {
      extensions: { code: 'FORBIDDEN' }
    });
  }

  return user;
};

export const requireOwnership = async (context: GraphQLContext, resourceOwnerId: string) => {
  const user = requireAuth(context);

  if (user.userId !== resourceOwnerId && user.role !== 'ADMIN') {
    throw new GraphQLError('Access denied. You can only access your own resources.', {
      extensions: { code: 'FORBIDDEN' }
    });
  }

  return user;
};