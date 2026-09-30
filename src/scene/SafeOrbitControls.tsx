import { forwardRef, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Camera } from 'three';

export interface SafeOrbitControlsProps {
  makeDefault?: boolean;
  camera?: Camera;
  domElement?: HTMLElement;
  enableDamping?: boolean;
  dampingFactor?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
  panSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;
  enableZoom?: boolean;
  enableRotate?: boolean;
  enablePan?: boolean;
  onChange?: (e?: any) => void;
  onStart?: (e?: any) => void;
  onEnd?: (e?: any) => void;
  [key: string]: any;
}

class RobustOrbitControls extends ThreeOrbitControls {
  constructor(object: Camera, domElement?: HTMLElement) {
    super(object, domElement);

    // Three.js OrbitControls invokes domElement.releasePointerCapture(event.pointerId) in _onPointerUp
    // without a try-catch block. When the browser has already implicitly released pointer capture on
    // pointerup, releasePointerCapture throws a DOMException (InvalidPointerId / NotFoundError).
    // This uncaught error prevents `this.state = _STATE.NONE` and listener cleanup from executing,
    // leaving OrbitControls stuck in STATE.ROTATE after a desktop click.
    const originalPointerUp = (this as any)._onPointerUp;
    (this as any)._onPointerUp = (event: PointerEvent) => {
      try {
        originalPointerUp.call(this, event);
      } catch {
        (this as any).state = -1; // _STATE.NONE
        (this as any)._pointers = [];
        (this as any)._pointerPositions = {};
        if (this.domElement) {
          try {
            this.domElement.releasePointerCapture(event.pointerId);
          } catch {}
          this.domElement.removeEventListener('pointermove', (this as any)._onPointerMove);
          this.domElement.removeEventListener('pointerup', (this as any)._onPointerUp);
        }
        this.dispatchEvent({ type: 'end' });
      }
    };

    // Prevent phantom rotation on desktop: if a mousemove event occurs with zero buttons pressed
    // (event.buttons === 0), OrbitControls must never rotate or pan the camera.
    const originalPointerMove = (this as any)._onPointerMove;
    (this as any)._onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && event.buttons === 0) {
        if ((this as any).state !== -1) {
          (this as any).state = -1; // _STATE.NONE
          (this as any)._pointers = [];
          (this as any)._pointerPositions = {};
          if (this.domElement) {
            this.domElement.removeEventListener('pointermove', (this as any)._onPointerMove);
            this.domElement.removeEventListener('pointerup', (this as any)._onPointerUp);
          }
          this.dispatchEvent({ type: 'end' });
        }
        return;
      }
      originalPointerMove.call(this, event);
    };
  }

  _getSecondPointerPosition(event: any): any {
    const pointers = (this as any)._pointers;
    const pointerPositions = (this as any)._pointerPositions;
    if (!pointers || pointers.length < 2 || !pointerPositions) {
      return null;
    }
    const pointerId = event.pointerId === pointers[0] ? pointers[1] : pointers[0];
    if (pointerId === undefined) {
      return null;
    }
    return pointerPositions[pointerId] || null;
  }

  _handleTouchStartDolly(event: any): void {
    const position = this._getSecondPointerPosition(event);
    if (!position) return;
    (ThreeOrbitControls.prototype as any)._handleTouchStartDolly.call(this, event);
  }

  _handleTouchStartPan(event: any): void {
    const pointers = (this as any)._pointers;
    if (pointers && pointers.length > 1) {
      const position = this._getSecondPointerPosition(event);
      if (!position) return;
    }
    (ThreeOrbitControls.prototype as any)._handleTouchStartPan.call(this, event);
  }

  _handleTouchStartRotate(event: any): void {
    const pointers = (this as any)._pointers;
    if (pointers && pointers.length > 1) {
      const position = this._getSecondPointerPosition(event);
      if (!position) return;
    }
    (ThreeOrbitControls.prototype as any)._handleTouchStartRotate.call(this, event);
  }

  _handleTouchMoveDolly(event: any): void {
    const position = this._getSecondPointerPosition(event);
    if (!position) return;
    (ThreeOrbitControls.prototype as any)._handleTouchMoveDolly.call(this, event);
  }

  _handleTouchMovePan(event: any): void {
    const pointers = (this as any)._pointers;
    if (pointers && pointers.length > 1) {
      const position = this._getSecondPointerPosition(event);
      if (!position) return;
    }
    (ThreeOrbitControls.prototype as any)._handleTouchMovePan.call(this, event);
  }

  _handleTouchMoveRotate(event: any): void {
    const pointers = (this as any)._pointers;
    if (pointers && pointers.length > 1) {
      const position = this._getSecondPointerPosition(event);
      if (!position) return;
    }
    (ThreeOrbitControls.prototype as any)._handleTouchMoveRotate.call(this, event);
  }
}

export const SafeOrbitControls = forwardRef<ThreeOrbitControls, SafeOrbitControlsProps>(
  (
    {
      makeDefault = false,
      camera,
      domElement,
      enableDamping = true,
      onChange,
      onStart,
      onEnd,
      ...restProps
    },
    ref
  ) => {
    const defaultCamera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const events = useThree((state) => state.events);
    const set = useThree((state) => state.set);
    const get = useThree((state) => state.get);
    const invalidate = useThree((state) => state.invalidate);

    const explCamera = camera || defaultCamera;
    const explDomElement = domElement || (events as any)?.connected || gl.domElement;

    const controls = useMemo(() => {
      const ctrl = new RobustOrbitControls(explCamera, explDomElement);
      return ctrl;
    }, [explCamera, explDomElement]);

    useFrame(() => {
      if (controls.enabled) controls.update();
    }, -1);

    useEffect(() => {
      const callback = (e: any) => {
        invalidate();
        if (onChange) onChange(e);
      };
      const onStartCb = (e: any) => {
        if (onStart) onStart(e);
      };
      const onEndCb = (e: any) => {
        if (onEnd) onEnd(e);
      };
      controls.addEventListener('change', callback);
      controls.addEventListener('start', onStartCb);
      controls.addEventListener('end', onEndCb);
      return () => {
        controls.removeEventListener('start', onStartCb);
        controls.removeEventListener('end', onEndCb);
        controls.removeEventListener('change', callback);
      };
    }, [onChange, onStart, onEnd, controls, invalidate]);

    useEffect(() => {
      if (makeDefault) {
        const old = get().controls;
        set({ controls });
        return () => set({ controls: old });
      }
    }, [makeDefault, controls, set, get]);

    useEffect(() => {
      const handleGlobalPointerUp = (e: PointerEvent) => {
        if (e.pointerType !== 'touch' && e.buttons === 0 && (controls as any).state !== -1) {
          (controls as any).state = -1;
          (controls as any)._pointers = [];
          (controls as any)._pointerPositions = {};
          if (explDomElement) {
            explDomElement.removeEventListener('pointermove', (controls as any)._onPointerMove);
            explDomElement.removeEventListener('pointerup', (controls as any)._onPointerUp);
          }
          controls.dispatchEvent({ type: 'end' });
        }
      };

      const handleLostPointerCapture = () => {
        if ((controls as any).state !== -1) {
          (controls as any).state = -1;
          (controls as any)._pointers = [];
          (controls as any)._pointerPositions = {};
          if (explDomElement) {
            explDomElement.removeEventListener('pointermove', (controls as any)._onPointerMove);
            explDomElement.removeEventListener('pointerup', (controls as any)._onPointerUp);
          }
          controls.dispatchEvent({ type: 'end' });
        }
      };

      window.addEventListener('pointerup', handleGlobalPointerUp);
      if (explDomElement) {
        explDomElement.addEventListener('lostpointercapture', handleLostPointerCapture);
      }

      return () => {
        window.removeEventListener('pointerup', handleGlobalPointerUp);
        if (explDomElement) {
          explDomElement.removeEventListener('lostpointercapture', handleLostPointerCapture);
        }
      };
    }, [controls, explDomElement]);

    useEffect(() => {
      return () => {
        controls.dispose();
      };
    }, [controls]);

    return (
      <primitive
        ref={ref}
        object={controls}
        enableDamping={enableDamping}
        {...restProps}
      />
    );
  }
);

export default SafeOrbitControls;
