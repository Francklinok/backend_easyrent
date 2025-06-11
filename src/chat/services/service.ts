
async function analyzeMessageWithAI(content, messageType) {
  const insights = {
    sentiment: 'neutral',
    intentDetection: 'general',
    autoSuggestions: [],
    priority: 'medium'
  };

  if (!content) return insights;

  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('merci') || lowerContent.includes('parfait') || lowerContent.includes('excellent')) {
    insights.sentiment = 'positive';
  } else if (lowerContent.includes('problème') || lowerContent.includes('pas bien') || lowerContent.includes('erreur')) {
    insights.sentiment = 'negative';
  }

  if (lowerContent.includes('achat') || lowerContent.includes('acheter')) {
    insights.intentDetection = 'purchase';
    insights.priority = 'high';
  } else if (lowerContent.includes('visite') || lowerContent.includes('voir')) {
    insights.intentDetection = 'visit';
    insights.priority = 'high';
  } else if (lowerContent.includes('prix') || lowerContent.includes('négocier')) {
    insights.intentDetection = 'negotiation';
    insights.priority = 'high';
  }

  if (insights.intentDetection === 'visit') {
    insights.autoSuggestions = [
      'Quand seriez-vous disponible pour une visite ?',
      'Je peux organiser une visite virtuelle si vous préférez.',
      'Cette propriété est disponible pour une visite cette semaine.'
    ];
  }

  return insights;
}

export default  analyzeMessageWithAI