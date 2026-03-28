# Homogeneisation divergente

**Simulation gravitationnelle de la convergence culturelle**

An interactive particle simulation visualizing the dynamics of cultural homogenization as described in the article *"Un modele pour les gouverner tous: les modeles historionomiques comme phenomenes emergents de l'homogeneisation culturelle."*

Particles in a 2D cultural space attract each other via gravity, forming hierarchical clusters that demonstrate how the same process produces local convergence and inter-group divergence simultaneously — the mechanism the article calls *homogeneisation divergente*.

## Live demo

**[https://YOUR_USERNAME.github.io/homogeneisation-divergente/]()**

## How it works

- Each particle represents a cultural entity. Its **position** in the 2D space is its cultural identity.
- **Color** encodes position via okLAB — similar colors mean similar cultures.
- **Gravity** pulls particles toward each other. Nearby particles cluster first (local homogenization, H+).
- As clusters tighten, **gaps emerge** between them — these are cultural frontiers (inter-group divergence, H-).
- Over time, clusters attract each other and **merge at larger scales** (agglutination), repeating the pattern.
- A short-range **repulsive force** prevents particle overlap, creating soft extended blobs.

This reproduces the article's key insight: cultural homogenization proceeds by divergence — local groups become internally more uniform while becoming more distinct from their neighbors, until they eventually merge.

## Controls

| Control | Description |
|---------|-------------|
| **Start / Pause** | Toggle simulation |
| **Reset** | Replay same seed from initial state |
| **Reseed** | Generate new random initial distribution |
| **Export** | Record simulation as WebM video (frame-perfect, offline rendering) |
| **Cancel recording** | Abort export without downloading |
| **Speed** | Simulation speed multiplier |
| **Falloff** | Gravity distance exponent (lower = more uniform pull across distances) |
| **Damping** | Velocity decay (higher = more momentum) |
| **Particles** | Number of particles (reseeds on change) |
| **Clusters** | Number of density seed points (reseeds on change) |

## Running locally

```bash
cd gravite-culturelle
python3 -m http.server 8000
# Open http://localhost:8000
```

No build step. No dependencies to install. Just a static file server.

## Deploying to GitHub Pages

The app lives in the `gravite-culturelle/` directory. Configure GitHub Pages to serve from that folder, or from root with a redirect.

## Tech stack

- Vanilla JavaScript (ES modules)
- Canvas 2D
- [lil-gui](https://lil-gui.georgealways.com/) for controls (loaded from CDN)
- [webm-muxer](https://github.com/nicxtreme/webm-muxer) + WebCodecs for frame-perfect video export (loaded from CDN)
- okLAB color space for perceptually uniform color mapping

## Based on

Article: *"Un modele pour les gouverner tous: les modeles historionomiques comme phenomenes emergents de l'homogeneisation culturelle"* — a theoretical framework showing that political structures (feudal, oligarchic, absolutist, parliamentary) emerge naturally from the progressive homogenization of cultural spaces.

## License

MIT
