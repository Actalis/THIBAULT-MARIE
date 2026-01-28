import { ASSET_MANIFEST, ImageKey, SoundKey } from './assetsConfig';

class AssetManager {
  private images: Map<string, HTMLImageElement> = new Map();
  private sounds: Map<string, AudioBuffer> = new Map();
  private audioContext: AudioContext | null = null;
  private totalAssets: number = 0;
  private loadedAssets: number = 0;

  constructor() {
    // Initialise l'AudioContext uniquement sur interaction utilisateur (standard navigateur)
    // Sera appelé via initAudio()
  }

  // Initialise le contexte audio (à appeler lors du premier clic/touche)
  initAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Lance le chargement de TOUS les assets définis dans assetsConfig.ts
  async loadAll(): Promise<void> {
    const imageKeys = Object.keys(ASSET_MANIFEST.images) as ImageKey[];
    const soundKeys = Object.keys(ASSET_MANIFEST.sounds) as SoundKey[];
    
    this.totalAssets = imageKeys.length + soundKeys.length;
    this.loadedAssets = 0;

    console.log(`[AssetManager] Début du chargement de ${this.totalAssets} assets...`);

    const imagePromises = imageKeys.map(key => 
      this.loadImage(key, ASSET_MANIFEST.images[key])
    );

    const soundPromises = soundKeys.map(key => 
      this.loadSound(key, ASSET_MANIFEST.sounds[key])
    );

    try {
      await Promise.all([...imagePromises, ...soundPromises]);
      console.log('[AssetManager] Tous les assets sont chargés avec succès !');
    } catch (error) {
      console.error('[AssetManager] Erreur critique lors du chargement :', error);
      throw error; // Propager l'erreur pour bloquer le démarrage du jeu si nécessaire
    }
  }

  private loadImage(key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        this.images.set(key, img);
        this.loadedAssets++;
        // console.log(`[Img] Chargé: ${key}`);
        resolve();
      };
      img.onerror = () => {
        console.warn(`[AssetManager] Impossible de charger l'image: ${url}. Utilisation d'un placeholder.`);
        // Fallback: Créer un carré rose pour indiquer l'erreur visuellement
        this.createPlaceholderImage(key);
        resolve(); // On résout quand même pour ne pas bloquer le jeu
      };
    });
  }

  private async loadSound(key: string, url: string): Promise<void> {
    if (!this.audioContext) {
        // Si pas d'audio context (ex: préchargement avant interaction), on diffère ou on skip
        // Pour ce loader, on suppose que initAudio a été appelé ou sera géré
        // Ici, on fait une requête fetch simple pour le buffer
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      // On ne peut décoder que si on a le contexte. 
      // Si le contexte n'est pas là, on stocke le buffer brut (optionnel)
      // Pour simplifier, on force l'initAudio avant le loadAll dans le main.
      if(this.audioContext) {
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.sounds.set(key, audioBuffer);
          this.loadedAssets++;
          // console.log(`[Snd] Chargé: ${key}`);
      }
    } catch (error) {
      console.warn(`[AssetManager] Impossible de charger le son: ${url}`, error);
      // Pas de son critique, on continue
    }
  }

  // Création d'une texture de remplacement (Carré Rose/Noir)
  private createPlaceholderImage(key: string) {
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if(ctx) {
          ctx.fillStyle = '#ff00ff'; // Magenta pur
          ctx.fillRect(0,0,32,32);
          ctx.fillStyle = '#000000';
          ctx.fillRect(0,0,16,16);
          ctx.fillRect(16,16,16,16);
          const img = new Image();
          img.src = canvas.toDataURL();
          this.images.set(key, img);
      }
  }

  // --- API PUBLIQUE ---

  public getImage(key: ImageKey): HTMLImageElement | undefined {
    return this.images.get(key);
  }

  public playSound(key: SoundKey, volume: number = 1.0, loop: boolean = false): AudioBufferSourceNode | null {
    if (!this.audioContext || !this.sounds.has(key)) return null;

    const source = this.audioContext.createBufferSource();
    source.buffer = this.sounds.get(key)!;
    source.loop = loop;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start();
    return source;
  }

  public getProgress(): number {
    if (this.totalAssets === 0) return 0;
    return this.loadedAssets / this.totalAssets;
  }
}

// Instance unique (Singleton) à utiliser partout
export const Assets = new AssetManager();
