import { OpenAPIV3 } from 'openapi-types';
import { IRequest } from 'itty-router';

// Store metadata about each route
export const routeMetadata: Map<string, OpenAPIV3.PathItemObject> = new Map();

// Interface for route decorator options
export interface RouteMetadataOptions {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete';
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIV3.ParameterObject[];
  requestBody?: OpenAPIV3.RequestBodyObject;
  responses?: { [key: string]: OpenAPIV3.ResponseObject };
}

// Main decorator for adding OpenAPI metadata to routes
export function ApiOperation(options: RouteMetadataOptions): MethodDecorator {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const metadata: OpenAPIV3.OperationObject = {
      summary: options.summary || '',
      description: options.description || '',
      tags: options.tags || [],
      parameters: options.parameters || [],
      requestBody: options.requestBody,
      responses: options.responses || {
        '200': {
          description: 'Successful operation',
        },
      },
    };

    const pathItem = routeMetadata.get(options.path) || {};
    pathItem[options.method] = metadata;
    routeMetadata.set(options.path, pathItem);

    return descriptor;
  };
}

// Helper function to generate OpenAPI spec
export function generateOpenApiSpec(): OpenAPIV3.Document {
  const spec: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title: 'Thread API',
      version: '1.0.0',
      description: 'API for managing threads, posts, and documents',
    },
    paths: {},
    components: {
      schemas: {
        Thread: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            creator: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            thread_id: { type: 'integer' },
            text: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            thread_id: { type: 'integer' },
            title: { type: 'string' },
            content: { type: 'string' },
            type: { type: 'string' },
          },
        },
      },
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  };

  // Add paths based on collected metadata
  routeMetadata.forEach((pathItem, path) => {
    spec.paths[path] = pathItem;
  });

  return spec;
}
