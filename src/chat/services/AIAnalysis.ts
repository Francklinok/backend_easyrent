

class AIAnalysisService {
  static async analyzeMessage(content: string, messageType: string, userId: string): Promise<any> {
    try {
      const [sentiment, language, topics, entities, intent] = await Promise.all([
        this.analyzeSentiment(content),
        this.detectLanguage(content),
        this.extractTopics(content),
        this.extractEntities(content),
        this.detectIntent(content)
      ]);

      return {
        sentiment,
        language,
        topics,
        entities,
        intent,
        urgency: this.assessUrgency(content, sentiment),
        confidence: this.calculateConfidence(content),
        processingTime: Date.now(),
        suggestions: this.generateSuggestions(content, intent)
      };
    } catch (error) {
      console.error('Erreur analyse IA:', error);
      return {
        sentiment: { score: 0, label: 'neutral' },
        language: 'unknown',
        topics: [],
        entities: [],
        intent: 'unknown',
        urgency: 'normal',
        confidence: 0,
        error: 'Analysis failed'
      };
    }
  }

  private static async analyzeSentiment(content: string): Promise<{ score: number; label: string }> {
    const positiveWords = ['bon', 'bien', 'super', 'génial', 'parfait', 'excellent', 'good', 'great', 'awesome', 'love', 'amazing'];
    const negativeWords = ['mauvais', 'mal', 'terrible', 'horrible', 'nul', 'bad', 'awful', 'hate', 'worst', 'disgusting'];
    
    const contentLower = content.toLowerCase();
    const words = contentLower.split(/\W+/);
    
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    const score = (positiveCount - negativeCount) / Math.max(words.length, 1);
    
    return {
      score: Math.max(-1, Math.min(1, score * 2)), // Normaliser entre -1 et 1
      label: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral'
    };
  }

  private static async detectLanguage(content: string): Promise<string> {
    const languagePatterns = {
      fr: ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'dans', 'avec', 'pour', 'sur', 'ce', 'cette', 'ces'],
      en: ['the', 'and', 'or', 'in', 'with', 'for', 'on', 'at', 'by', 'from', 'this', 'that', 'these'],
      es: ['el', 'la', 'los', 'las', 'de', 'del', 'y', 'o', 'en', 'con', 'para', 'sobre'],
      de: ['der', 'die', 'das', 'und', 'oder', 'in', 'mit', 'für', 'auf', 'von']
    };
    
    const words = content.toLowerCase().split(/\W+/);
    const scores: Record<string, number> = {};
    
    Object.entries(languagePatterns).forEach(([lang, patterns]) => {
      scores[lang] = words.filter(word => patterns.includes(word)).length;
    });
    
    const detectedLang = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];
    return scores[detectedLang] > 0 ? detectedLang : 'unknown';
  }

  private static async extractTopics(content: string): Promise<string[]> {
    const topicKeywords = {
      'technologie': ['code', 'app', 'web', 'mobile', 'tech', 'software', 'développement', 'programmation', 'api'],
      'immobilier': ['maison', 'appartement', 'vente', 'achat', 'location', 'propriété', 'terrain', 'investissement'],
      'travail': ['job', 'travail', 'emploi', 'bureau', 'meeting', 'réunion', 'projet', 'équipe'],
      'personnel': ['famille', 'ami', 'personnel', 'privé', 'vie', 'relation', 'amour'],
      'finance': ['argent', 'prix', 'coût', 'budget', 'investissement', 'épargne', 'banque'],
      'santé': ['santé', 'médecin', 'hôpital', 'maladie', 'sport', 'exercice', 'nutrition']
    };

    const contentLower = content.toLowerCase();
    const topics: string[] = [];
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      const matchCount = keywords.filter(keyword => contentLower.includes(keyword)).length;
      if (matchCount > 0) {
        topics.push(topic);
      }
    });

    return topics;
  }

  private static extractEntities(content: string): Array<{ type: string; value: string; confidence: number }> {
    const entities: Array<{ type: string; value: string; confidence: number }> = [];
    
    // Email avec validation améliorée
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailRegex);
    if (emails) {
      emails.forEach(email => {
        entities.push({ 
          type: 'email', 
          value: email, 
          confidence: email.includes('.') && email.includes('@') ? 0.9 : 0.6 
        });
      });
    }
    
    // URLs avec meilleure détection
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const urls = content.match(urlRegex);
    if (urls) {
      urls.forEach(url => {
        entities.push({ 
          type: 'url', 
          value: url, 
          confidence: url.startsWith('http') ? 0.9 : 0.7 
        });
      });
    }
    
    // Numéros de téléphone internationaux
    const phoneRegex = /(\+?[1-9]\d{1,14}|\b\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}\b)/g;
    const phones = content.match(phoneRegex);
    if (phones) {
      phones.forEach(phone => {
        entities.push({ 
          type: 'phone', 
          value: phone, 
          confidence: phone.includes('+') ? 0.8 : 0.6 
        });
      });
    }

    // Dates
    const dateRegex = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g;
    const dates = content.match(dateRegex);
    if (dates) {
      dates.forEach(date => {
        entities.push({ 
          type: 'date', 
          value: date, 
          confidence: 0.7 
        });
      });
    }
    
    return entities;
  }

  private static detectIntent(content: string): string {
    const intentPatterns = {
      question: [/\?/, /comment/, /pourquoi/, /quand/, /où/, /qui/, /how/, /why/, /when/, /where/, /who/],
      request: [/peux-tu/, /pouvez-vous/, /can you/, /could you/, /please/, /s'il vous plaît/],
      gratitude: [/merci/, /thanks/, /thank you/, /grazie/, /danke/],
      greeting: [/salut/, /hello/, /bonjour/, /hi/, /hey/, /bonsoir/],
      goodbye: [/au revoir/, /bye/, /goodbye/, /à bientôt/, /see you/],
      agreement: [/oui/, /yes/, /d'accord/, /ok/, /exactly/, /absolument/],
      disagreement: [/non/, /no/, /pas d'accord/, /disagree/, /absolutely not/],
      complaint: [/problème/, /bug/, /erreur/, /problem/, /issue/, /error/],
      compliment: [/bravo/, /félicitations/, /bien joué/, /great job/, /congratulations/]
    };

    const contentLower = content.toLowerCase();
    
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      if (patterns.some(pattern => pattern.test(contentLower))) {
        return intent;
      }
    }
    
    return 'statement';
  }

  private static assessUrgency(content: string, sentiment: any): 'low' | 'normal' | 'high' | 'urgent' {
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'immédiat', 'maintenant', 'vite', 'rapidement', 'critical'];
    const contentLower = content.toLowerCase();
    
    if (urgentKeywords.some(keyword => contentLower.includes(keyword))) {
      return 'urgent';
    }
    
    if (sentiment?.score < -0.7) {
      return 'high';
    }
    
    if (sentiment?.score < -0.3) {
      return 'normal';
    }
    
    return 'low';
  }

  private static calculateConfidence(content: string): number {
    const factors = {
      length: Math.min(content.length / 100, 1),
      complexity: (content.match(/[.!?]/g) || []).length / 10,
      vocabulary: new Set(content.toLowerCase().split(/\W+/)).size / content.split(/\W+/).length
    };
    
    return Math.min(0.9, (factors.length + factors.complexity + factors.vocabulary) / 3);
  }

  private static generateSuggestions(content: string, intent: string): string[] {
    const suggestions: string[] = [];
    
    if (intent === 'question') {
      suggestions.push('Besoin de plus d\'informations ?', 'Je peux vous aider avec ça');
    }
    
    if (intent === 'complaint') {
      suggestions.push('Désolé pour ce problème', 'Puis-je vous aider à résoudre cela ?');
    }
    
    if (intent === 'gratitude') {
      suggestions.push('De rien !', 'Ravi d\'avoir pu aider');
    }
    
    return suggestions;
  }
}
export  default AIAnalysisService