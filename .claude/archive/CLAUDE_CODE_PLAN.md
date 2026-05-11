# Historical Reference Only

This file is archived for context. It is not active project guidance. Use `AGENTS.md`, `CLAUDE.md`, `PLAN.md`, and `.claude/rules/` for current instructions.

# Psychedelic Playground Evolution Plan
## Claude Code Implementation Strategy

### 🎯 Mission
Transform the existing Psychedelic Playground from a "single reactive blob" into a "multi-layer generative audiovisual field system" by integrating advanced shader techniques, improved audio-visual mapping, and layered visual architecture while preserving all existing infrastructure.

### 📋 Analysis Phase
**Claude Code must first perform a comprehensive codebase analysis:**

1. **Full Codebase Scan**
   - Read all shader files (psychedelic.frag, trail.frag, particle.vert/frag)
   - Analyze useThreeScene.js render loop structure
   - Review audio pipeline (analyser.js, bands.js)
   - Examine state management (useStore.js, BehavioralController.js)
   - Map current rendering pipeline (three-pass system)

2. **Current System Mapping**
   - Document existing SDF implementation (blob + orbit modes)
   - Identify audio band usage (bass/mid/hi/sub)
   - Catalog current visual layers (main render, trail, particles)
   - Assess performance bottlenecks

3. **Research Integration Analysis**
   - Compare current Perlin FBM vs Simplex noise potential
   - Evaluate Worley noise for surface detail
   - Assess domain warping complexity vs current warping
   - Review PBR lighting vs current diffuse model
   - Analyze bloom/post-processing fit with existing trail system

### 🧠 Decision Framework
**For each proposed enhancement, Claude Code must evaluate:**

- **Compatibility**: Does it fit existing Three.js/WebGL architecture?
- **Performance Impact**: GPU cost vs 60fps requirement on M1 Max
- **Audio Integration**: How well it leverages current 4-band analysis
- **Visual Coherence**: Does it enhance the "living field" feeling?
- **Implementation Risk**: Low/Medium/High based on code changes needed

### 🌌 Layer Implementation Priority

#### 1. CORE MASS LAYER (HIGH PRIORITY)
**Current State:** Basic SDF blob with FBM displacement
**Proposed Enhancements:**
- Replace Perlin with Simplex noise for better performance
- Add Worley cellular noise for organic surface variation
- Implement advanced domain warping for complex deformations
- Enhance SDF with metaball-like interactions

**Risk Assessment:** LOW - Direct shader replacements, no architecture changes

#### 2. REACTIVE SURFACE LAYER (HIGH PRIORITY)
**Current State:** Basic surface detail via FBM
**Proposed Enhancements:**
- Add turbulence from high-frequency audio
- Implement subsurface scattering approximation
- Enhanced normal mapping for surface detail
- Audio-driven roughness/metalness modulation

**Risk Assessment:** MEDIUM - Requires new uniforms, careful performance monitoring

#### 3. MEMORY/ECHO LAYER (MEDIUM PRIORITY)
**Current State:** Basic trail system with decay
**Proposed Enhancements:**
- Multiple history buffers for richer persistence
- Audio-modulated decay rates
- Enhanced drift effects with curl noise
- Temporal anti-aliasing integration

**Risk Assessment:** LOW - Extends existing trail.frag, no major changes

#### 4. FIELD BACKGROUND LAYER (HIGH PRIORITY)
**Current State:** Minimal background fog
**Proposed Enhancements:**
- Procedural flow field using curl noise
- Depth-based atmospheric effects
- Audio-influenced field movement
- Seamless integration with foreground

**Risk Assessment:** MEDIUM - New shader pass needed, but can reuse existing infrastructure

#### 5. PARTICLE ATMOSPHERE LAYER (MEDIUM PRIORITY)
**Current State:** Basic particles with mode-specific spawning
**Proposed Enhancements:**
- GPU physics via transform feedback
- Flow field influence
- Advanced rendering (soft particles, depth sorting)
- Improved audio responsiveness

**Risk Assessment:** HIGH - Requires WebGL extensions, potential performance impact

### 🎧 Audio System Evolution

#### Current Issues Identified:
- Lack of phase tracking (only amplitude)
- No beat detection stability
- Limited temporal smoothing

#### Required Improvements:
1. **Beat Phase Tracking**
   - Implement onset strength detection
   - Add BPM estimation
   - Phase-based visual modulation

2. **Enhanced Band Processing**
   - Spectral centroid for timbre analysis
   - Better frequency band separation
   - Temporal smoothing (fast attack, slow decay)

3. **Audio-Visual Sync**
   - Phase-aligned responses
   - Reduced latency
   - Predictive energy envelopes

**Implementation Priority:** HIGH - Critical for "living" feel

### 🌀 Mode System Preservation

**Strict Rules:**
- Mode changes = influence weight adjustments, not resets
- All transitions use exponential interpolation
- Visual state continuity maintained
- No hard cuts between modes

**Implementation:** Extend existing modeBlend system with smoother transitions

### 🌈 Color System Evolution

**From Static to Dynamic:**
- Time-based palette drift
- Audio-driven hue modulation
- Smooth interpolation between palettes
- Energy-based brightness variation

**Integration:** Extend existing palette system with phase-based evolution

### 📊 Implementation Phases

#### PHASE 1: Foundation (Low Risk, High Impact)
1. Replace Perlin noise with Simplex in psychedelic.frag
2. Add Worley noise for surface detail
3. Implement basic domain warping
4. Enhance audio phase tracking

#### PHASE 2: Surface Enhancement (Medium Risk)
1. Add subsurface scattering
2. Implement bloom post-processing
3. Enhanced particle system
4. Improved temporal smoothing

#### PHASE 3: Field Architecture (Medium-High Risk)
1. Add background flow field layer
2. Multiple history buffers
3. Advanced audio-visual mapping
4. Performance optimization

#### PHASE 4: Polish (High Risk, Optional)
1. PBR lighting system
2. GPU particle physics
3. Advanced post-processing stack
4. Real-time adaptation

### ⚠️ Risk Mitigation

**Performance Monitoring:**
- GPU profiling at each phase
- Frame time budgets (16.67ms target)
- Memory usage tracking
- Fallback options for heavy features

**Compatibility Checks:**
- Test on target hardware (M1 Max)
- Browser compatibility validation
- Mobile performance assessment
- Audio pipeline stability

**Incremental Implementation:**
- Feature flags for new systems
- Easy rollback mechanisms
- Comprehensive testing per phase
- User feedback integration

### 🎯 Success Metrics

**Visual Quality:**
- Organic, living appearance
- Smooth audio responsiveness
- Depth and layering perception
- Hypnotic continuity

**Performance:**
- Stable 60fps on M1 Max
- <100ms audio latency
- Smooth mode transitions
- No memory leaks

**Audio Integration:**
- Beat-synced visuals
- Frequency band coherence
- Phase-aware responses
- Musical structure recognition

### 🚀 Execution Plan for Claude Code

1. **Analysis (2-3 hours)**
   - Complete codebase reading
   - Current system documentation
   - Research comparison matrix

2. **Planning (1-2 hours)**
   - Risk assessment per feature
   - Implementation priority matrix
   - Phase breakdown with dependencies

3. **Prototype Implementation (4-6 hours)**
   - Phase 1 foundation features
   - Performance validation
   - Audio integration testing

4. **Iterative Enhancement (Ongoing)**
   - Phase-by-phase implementation
   - Continuous performance monitoring
   - User testing and feedback

### 📝 Output Deliverables

1. **ANALYSIS.md** - Current system documentation
2. **COMPARISON.md** - Research vs current capabilities matrix
3. **IMPLEMENTATION.md** - Detailed phase plans with code snippets
4. **PERFORMANCE.md** - Benchmarking and optimization guide
5. **ROADMAP.md** - Long-term evolution strategy

---

**This plan ensures Claude Code can systematically evolve the system while maintaining stability and performance. Each phase builds upon the last, with clear risk assessments and rollback options.**</content>
<parameter name="filePath">/Users/keegankemp/Documents/Claude_OS/Psychedelic_App_Test/PLAN.md
