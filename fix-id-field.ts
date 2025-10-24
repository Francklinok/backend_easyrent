const fs = require('fs');
const path = require('path');

const resolverPath = path.join(__dirname, 'src/property/graphql/propertyResolvers.ts');

// Lire le fichier
let content = fs.readFileSync(resolverPath, 'utf8');

// Ajouter un field resolver pour 'id' après ownerId
const ownerIdResolver = `  Property: {
    // Extract ID from ownerId if it's populated
    ownerId: (property: any) => {
      if (property.ownerId) {
        // If it's an object (populated), return the _id
        if (typeof property.ownerId === 'object' && property.ownerId._id) {
          return property.ownerId._id.toString();
        }
        // If it's already a string/ObjectId, return it
        return property.ownerId.toString();
      }
      return null;
    },`;

const withIdResolver = `  Property: {
    // Map MongoDB _id to GraphQL id
    id: (property: any) => {
      return property._id?.toString() || property.id?.toString() || null;
    },

    // Extract ID from ownerId if it's populated
    ownerId: (property: any) => {
      if (property.ownerId) {
        // If it's an object (populated), return the _id
        if (typeof property.ownerId === 'object' && property.ownerId._id) {
          return property.ownerId._id.toString();
        }
        // If it's already a string/ObjectId, return it
        return property.ownerId.toString();
      }
      return null;
    },`;

content = content.replace(ownerIdResolver, withIdResolver);

// Écrire le fichier modifié
fs.writeFileSync(resolverPath, content, 'utf8');

console.log('✅ id field resolver added:');
console.log('   - Maps MongoDB _id to GraphQL id field');
console.log('   - Handles both _id and id cases');
