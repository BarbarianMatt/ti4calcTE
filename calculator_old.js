(function (root) {
	var structs, game;
	if (typeof require === 'function') {
		structs = require('./structs');
		game = require('./game-elements');
	} else {
		structs = window;
		game = window;
	}

	
	root.calculator = (function () {
		
		var rollBoosts = initExtraRolls();
		var activations = initActivations();
		var continuousUnitAbilities = initContinuousUnitAbilities();
		var passiveContinuousAbilities = initPassiveContinuousAbilities();


		var activeBoosts = initActiveBoosts();
		var passiveBoosts = initPassiveBoosts();

		var activeRollBoosts = initActiveRollBoosts();
		var passiveRollBoosts = initPassiveRollBoosts();

		var activeRerolls = initActiveRerolls();
		var passiveRerolls = initPassiveRerolls();

		var cancelHits = initCancelHits();

		const TIMING_PARENTS = {
				startOfCombat: ['startOfRound'],
			};


		const timingsOrder = ['beforeCombat','spaceCannonOffense', 'bombardment', 'spaceCannonDefense', 'duringCombat', 'startOfCombat',  'barrage',  'combatRolls', 'endOfRound', 'cleanup'];
		// var prebattleActions = initPrebattleActions();

		// === caches (kept external so they persist across calls) ===
			// shared cache (kept outside so labels persist across calls)
			var cache = cache || {};
			cache.variantsByShortType = cache.variantsByShortType || new Map(); // shortType -> Map(sig -> variantIndex)
			cache.nextVariantIndex = cache.nextVariantIndex || new Map();      // shortType -> nextIndex

			// property name used on unit objects
			const LABEL_PROP = 'label'; // e.g. "D0"

			// Build a stable signature for a unit (exclude shortType)
			function stableUnitSignature(unit) {
				// build keys sorted, skipping 'shortType'
				const keys = Object.keys(unit);
				keys.sort();
				const parts = [];
				for (let i = 0; i < keys.length; i++) {
					const k = keys[i];
					if (k === 'shortType' || k === 'ghostCorporeal' || k === 'damageCorporeal' || k === 'flagPointers' || k === LABEL_PROP) continue;
					let v = unit[k];
					if (Array.isArray(v)) {
						const sorted = [...v].sort();
						v = JSON.stringify(sorted);
					} else if (v && typeof v === 'object') {
						// Stringify objects (non-array)
						v = JSON.stringify(v);
					} else {
						v = String(v);
					}
					parts.push(k, '=', v, '|');
				}
				return parts.join('');
			}

			function ensureVariantMapsFor(shortType) {
				if (!cache.variantsByShortType.has(shortType)) {
					cache.variantsByShortType.set(shortType, new Map());
					cache.nextVariantIndex.set(shortType, 0);
				}
			}

			// labelForUnit: if unit already labeled -> use it. Otherwise compute signature and reuse/create variant index.
			function labelForUnit_withSig(unit) {
				if (!unit) return ''; // defensive
				if (unit[LABEL_PROP]) return unit[LABEL_PROP];

				const st = unit.shortType;
				if (typeof st !== 'string') throw new Error('unit.shortType must be a string');

				ensureVariantMapsFor(st);

				const sig = stableUnitSignature(unit);
				const variantsMap = cache.variantsByShortType.get(st);

				let variantIndex = variantsMap.get(sig);
				if (variantIndex === undefined) {
					// allocate a new variant index
					variantIndex = cache.nextVariantIndex.get(st);
					variantsMap.set(sig, variantIndex);
					cache.nextVariantIndex.set(st, variantIndex + 1);
				}

				const label = st + variantIndex; // e.g. "D0"
				// attach label directly to the unit (mutating)
				unit[LABEL_PROP] = label;
				return label;
			}

			function sideToLabelString(sideArray) {
				if (!Array.isArray(sideArray) || sideArray.length === 0) return '';
				const labels = new Array(sideArray.length);
				for (let i = 0; i < sideArray.length; i++) labels[i] = labelForUnit_withSig(sideArray[i]);
				labels.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
				return labels.join('');
			}

			function appendResourcesSimple(resourcesObj) {
				const arr = Object.values(resourcesObj || {});
				if (arr.length === 0) return '-';
				arr.sort((x, y) => (x.shortType < y.shortType ? -1 : x.shortType > y.shortType ? 1 : 0));
				let out = '';
				for (let i = 0; i < arr.length; i++) out += arr[i].shortType + String(arr[i].total);
				return out + '-';
			}

			function appendFlagsSimple(flagsObj) {
				const arr = Object.values(flagsObj || {});
				if (arr.length === 0) return '';
				arr.sort((x, y) => (x.shortType < y.shortType ? -1 : x.shortType > y.shortType ? 1 : 0));
				let out = '';
				for (let i = 0; i < arr.length; i++) {
					const f = arr[i];
					out += f.shortType + (f.duration !== -1 ? String(f.duration) : '_');
				}
				return out;
			}

			// main function (mutating + signature-based lookup when unlabeled)
			function buildStateKey(attackerState, defenderState, resourcesState, flagsState) {
				const aLabel = sideToLabelString(attackerState || []) + '-';
				const dLabel = sideToLabelString(defenderState || []) + '-';

				const aRes = appendResourcesSimple(resourcesState && resourcesState.attacker);
				const dRes = appendResourcesSimple(resourcesState && resourcesState.defender);

				const aFlags = appendFlagsSimple(flagsState && flagsState.attacker);
				const dFlags = appendFlagsSimple(flagsState && flagsState.defender);

				return aLabel + aRes + aFlags + '|' + dLabel + dRes + dFlags;
			}



		return {
			computeProbabilities: computeProbabilities,
			fleetTransitionsVector: fleetTransitionsVector,
		};

		/** Compute survival probabilities of each subset of attacker and defender */
		function computeProbabilities(input) {
			var battleType = input.battleType;
			var options = input.options || { attacker: {}, defender: {} };
			





			





			
			
			
			var finalDistribution;
			var finalAttacker;
			var finalDefender;
			[finalDistribution, finalAttacker, finalDefender, finalAccumulations]=  propagateProbabilityAllDirections_hashtable(battleType,options,input);

			

			

			return {
				distribution: finalDistribution,
				attacker: finalAttacker.map(function (set) {
					return set.reduce(function (prev, item) {
						return prev + item;
					});
				}),
				defender: finalDefender.map(function (set) {
					return set.reduce(function (prev, item) {
						return prev + item;
					});
				}),
				accumulations: finalAccumulations,
			};

			
		}

		function nonFighterShip(unit){
			return unit.typeShip && unit.type !== game.UnitType.Fighter;
		}

		function fleetLength(fleet){
			return fleet.filter(unit => unit.type !== undefined && !unit.isDamageGhost && !unit.cancelHit).length;
		}


		

		

		function makeSustainHardPredicate(deadSim, oldHardPredicate) {
			// Collect all types of "damage ghost" units
			const ghostTypes = new Set(
				deadSim
				.filter(unit => unit.isDamageGhost)
				.map(unit => unit.type)
			);

			// Return the predicate function
			return function hardPredicate(unit) {
				return ghostTypes.has(unit.type) && oldHardPredicate(unit);
			};
		}


				

		function fastShallowCloneUnit(unit) {
			// create a new object with the same prototype (so methods exist)
			const newUnit = Object.create(Object.getPrototypeOf(unit));
			
			Object.assign(newUnit, unit);
			
			newUnit.damageCorporeal=undefined;
			newUnit.ghostCorporeal=undefined;
			newUnit.flagPointers=[];

			// this line might be necessary for the future, but for now text abilities of units don't change so its fine to keep a reference instead of copying it.
			// newUnit.abilities = [...unit.abilities]
			return newUnit;
		}

		function cloneFleet(fleet){
			const newFleet = new Array(fleet.length);
			
			const indexByUnit = new Map();
			for (let i = 0; i < fleet.length; i++) indexByUnit.set(fleet[i], i);

			// first pass: clone units (cheaply)
			for (let i = 0; i < fleet.length; i++) {
				const unit = fleet[i];
				newFleet[i] = fastShallowCloneUnit(unit);
			}

			// second pass: fix pointers (damageCorporeal etc.) using map lookup (O(n))
			for (let i = 0; i < fleet.length; i++) {
				const unit = fleet[i];
				const newUnit = newFleet[i];
				if (unit.damageCorporeal) {
					const idx = indexByUnit.get(unit.damageCorporeal);
				if (idx !== undefined){
					newUnit.damageCorporeal = newFleet[idx];
					newFleet[idx].ghostCorporeal = newUnit;
				}
				else newUnit.damageCorporeal = null; // or keep original, depending on semantics
				}
			}
			return newFleet;
		}

		function cloneFleetsAndFlags(attackerFleet, defenderFleet, flags){
			const newFleetA = new Array(attackerFleet.length);
			const newFleetD = new Array(defenderFleet.length);

			const newFlags = simpleListClone(flags);
			

			// print(attackerFleet[0].flagPointers[0] === flags.defender[1]);
			
			
			const indexByUnitA = new Map();
			for (let i = 0; i < attackerFleet.length; i++) indexByUnitA.set(attackerFleet[i], i);
			const indexByUnitD = new Map();
			for (let i = 0; i < defenderFleet.length; i++) indexByUnitD.set(defenderFleet[i], i);

			const indexByFlagA = new Map();
			for (let i = 0; i < flags.attacker.length; i++) indexByFlagA.set(flags.attacker[i], i);
			const indexByFlagD = new Map();
			for (let i = 0; i < flags.defender.length; i++) indexByFlagD.set(flags.defender[i], i);

			for (let i = 0; i < attackerFleet.length; i++) {
				const unit = attackerFleet[i];
				newFleetA[i] = fastShallowCloneUnit(unit);
			}

			for (let i = 0; i < defenderFleet.length; i++) {
				const unit = defenderFleet[i];
				newFleetD[i] = fastShallowCloneUnit(unit);
			}

			assignPointers(attackerFleet, newFleetA, indexByUnitA);
			assignPointers(defenderFleet, newFleetD, indexByUnitD);

			return [newFleetA, newFleetD, newFlags];

			function assignPointers(fleet, newFleet, indexByUnit){
				for (let i = 0; i < fleet.length; i++) {
					const unit = fleet[i];
					const newUnit = newFleet[i];

					if (unit.damageCorporeal) {
						const idx = indexByUnit.get(unit.damageCorporeal);
					if (idx !== undefined){
						newUnit.damageCorporeal = newFleet[idx];
						newFleet[idx].ghostCorporeal = newUnit;
					}
					else newUnit.damageCorporeal = null; 
					}

					

					var indicesA = [];
					var indicesD = [];
					if (unit.flagPointers.length > 0){
						indicesA = unit.flagPointers.map(flag => indexByFlagA.get(flag)).filter(idx => idx !== undefined);
						indicesD = unit.flagPointers.map(flag => indexByFlagD.get(flag)).filter(idx => idx !== undefined);

					}
					
					if (indicesA.length > 0){
						for (var idxFlag of indicesA){
							newUnit.flagPointers.push(newFlags.attacker[idxFlag]);
							newFlags.attacker[idxFlag].unitPointer = newUnit;
						}
					}
					if (indicesD.length > 0){
						for (var idxFlag of indicesD){
							newUnit.flagPointers.push(newFlags.defender[idxFlag]);
							newFlags.defender[idxFlag].unitPointer = newUnit;
						}
					}
				}
			}

			


		}

		function markDamagedNotThisRound(fleet) {
			for (var i = 0; i < fleet.length; i++) {
				if (fleet[i].sustainedThisRound) {
					fleet[i].update({sustainedThisRound: false});
				}
			}
		}

		function duraniumArmorRepair(fleet, battleType, thisSideFlags, thisSideOptions) {
			for (var i = 0; i < fleet.length; i++) {
				var unit = fleet[i];

				if (unit.damaged && !unit.sustainedThisRound) {
					const sustain = unit.toDamageGhost()
					
					
					unit.update({damaged: false});

					addUnit(fleet, sustain, battleType, thisSideFlags, thisSideOptions);
					
					return true;
				}
			}
			return false;
		}

		function applyContinuousEffectsOnUnits(units, thisSideFlags,  battleSide, battleType, timing, thisSideOptions){

			

			var effects = []
			for (const flag of thisSideFlags){
				if (flag.newUnitEffect !== undefined){
					effects.push(flag.newUnitEffect)
				}
			}
			for (const passive of passiveContinuousAbilities){
				if 	(
					passive.newUnitEffect !== undefined &&
					checkTiming(timing, passive.timing) && 
					passive.condition(thisSideOptions) ) {
						effects.push(passive.newUnitEffect)
					}
			}
			


			effects = effects.sort((a,b) => b.priority - a.priority);

			

			for (var i = units.length-1; i >= 0; i--) {
				const unit = units[i];
				
				for (const effect of effects){
					if (!effect(unit)){
						units.splice(i,1);
						break;
					}
				}
				
			}

			return units

			
		}

		

		function addUnit(fleet, unit, battleType, thisSideFlags, thisSideOptions, noSort, 
				opponentFleet, battleSide, thisSideResources, otherSideResources, otherSideFlags, timing, options, state, accumulation){

			var newUnit = applyContinuousEffectsOnUnits([unit], thisSideFlags,  battleSide, battleType, timing, thisSideOptions);
			if (newUnit.length > 0){ return false;}

			newUnit = newUnit[0];

			const allowedToParticipateSpace = battleType === 'Space' && (newUnit.typeShip || newUnit.flagPointers.some(flag => flag.name === 'nomadMech'));
			const allowedToParticipateGround = newUnit.typeGroundForce && battleType === 'Ground';

			if (newUnit.notParticipating || (!allowedToParticipateSpace && !allowedToParticipateGround)){
				return false;
			}
			

			fleet.push(newUnit);

			if (newUnit.sustainDamage && !newUnit.damaged && !newUnit.lostSustain && !newUnit.notUseSustain && newUnit.ghostCorporeal === undefined){
				
				var sustain=newUnit.toDamageGhost();
				fleet.push(sustain);
			}

			if (noSort === undefined || !noSort)
				game.fleetSort(fleet, thisSideOptions);

			

			for (const abilityName of newUnit.abilities){
				const ability = continuousUnitAbilities[abilityName];
				if (ability &&
					checkTiming(timing, ability.timing) &&
					ability.condition(fleet, opponentFleet, battleSide, battleType, thisSideResources, otherSideResources, thisSideOptions, newUnit, true)
				) {
					ability.effect(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, otherSideFlags, options, newUnit, state, accumulation);
				}
			}
			return true;
			
			

			// if (unit.isDamageGhost && thisSideFlags.some(obj => obj.name == 'mentakFlagship') && unit.typeShip){

			// 	if (unit.damageCorporeal){
			// 		unit.damageCorporeal.ghostCorporeal=undefined;
			// 	}
				
			// 	return false;
			// };



			// if (unit.isDamageGhost && thisSideFlags.some(obj => obj.name == 'mentakMech') && unit.typeGroundForce){
			// 	if (unit.damageCorporeal){
			// 		unit.damageCorporeal.ghostCorporeal=undefined;
			// 	}
			// 	return false;
			// }

			// const allowedToParticipateSpace = battleType === 'Space' && (unit.typeShip || unit.flagPointers.some(flag => flag.name === 'nomadMech'));
			// const allowedToParticipateGround = unit.typeGroundForce && battleType === 'Ground';

			

			// if (unit.notParticipating || (!allowedToParticipateSpace && !allowedToParticipateGround)){
			// 	return false;
			// }

			// if (battleType === 'Space'){
			// 	unit.spaceArea = true;
			// } else if (battleType === 'Ground') {
			// 	unit.planet = true;
			// }

			// fleet.push(unit);

			// if (state !== undefined) {

			// 	for (const abilityName of unit.abilities){
			// 		const ability = continuousUnitAbilities[abilityName];
			// 		if (ability &&
			// 			checkTiming(timing, ability.timing) &&
			// 			ability.condition(fleet, opponentFleet, battleSide, battleType, thisSideResources, otherSideResources, thisSideOptions, unit, true)
			// 		) {
			// 			ability.effect(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, otherSideFlags, options, unit, state, accumulation);
			// 		}
			// 	}
			// }
			// if (noSort === undefined || !noSort)
			// 	game.fleetSort(fleet, thisSideOptions);

			// return true;

			

		}

		function simpleClone(obj) {
			if (!obj){
				
				return obj;
			}
			const out = {};
			
			for (const k in obj) {
				const part = obj[k];
				if (!part || typeof part !== 'object') {
					out[k] = part;
					continue;
				}
				
				const partCopy = {};
				for (const p in part) {
				// copy primitives / small values. If values are objects you may want JSON/structured clone for them.
					partCopy[p] = part[p];
				}
				out[k] = partCopy;
			}
			return out;
		}
		function resourcesClone(obj) {
			
			const out = {};
			out.attacker = simpleClone(obj.attacker);
			out.defender = simpleClone(obj.defender);
			
			
			return out;
		}

		function simpleListClone(obj) {
			if (!obj) return obj;
			const out = {};
			for (const k in obj) {
				const arr = obj[k];
				if (!Array.isArray(arr)) {
					out[k] = arr; // primitive or non-array object
					continue;
				}
				const n = arr.length;
				const arrCopy = new Array(n);
				for (let i = 0; i < n; i++) {
					const el = arr[i];
					
					if (el && typeof el === 'object') {
						const cloned = { ...el };
						for (const prop in el) {
							if (prop === 'unitPointer') continue;
							cloned[prop] = el[prop];
						}
						if ('unitPointer' in el) {
							cloned.unitPointer = undefined;
						}
						arrCopy[i] = cloned;
					} else {
						arrCopy[i] = el;
					}
					
				}
				out[k] = arrCopy;
			}
			return out;
		}

		// function simpleListClone(obj) { 
		// 	if (!obj) return obj; 
		// 	const out = {}; 
		// 	for (const k in obj) { 
		// 		const arr = obj[k]; 
		// 		if (!Array.isArray(arr)) { 
		// 			out[k] = arr; 
					
		// 			continue; 
		// 		} const n = arr.length; 
		// 		const arrCopy = new Array(n); 
		// 		for (let i = 0; i < n; i++) { 
		// 			const el = arr[i]; 
					
		// 			arrCopy[i] = el && typeof el === 'object' ? { ...el } : el; 
		// 		} 
		// 		out[k] = arrCopy; 
		// 	} 
		// 	return out; 
		// }

		function resolveDead(deadUnitsAttacker, deadUnitsDefender, attackerFleet, defenderFleet, battleType, flags, timing, options){


		



			// var attackerPass = false;
			// var defenderPass = false;

			// state.turn = state.turn || 'attacker';
			// var loops = 0


			// while (!(attackerPass && defenderPass) && loops<10000){
			// 	loops++;
			// 	if (state.turn === 'attacker'){
			// }











			for (var i = 0; i < deadUnitsAttacker.length; i++) {
				const deadUnit = deadUnitsAttacker[i];

				
				
				for (const flagPointer of deadUnit.flagPointers){
					const index = flags[flagPointer.side].indexOf(flagPointer);
					const flag = flags[flagPointer.side][index];
					if (index !== -1) {
						flags[flagPointer.side].splice(index,1);
						const ability = continuousUnitAbilities[flagPointer.name];
						
						if (ability && ability.deathEffect !== undefined){
							ability.deathEffect(deadUnit, attackerFleet, defenderFleet, battleType, options.attacker, options.defender, flags.attacker, flags.defender);
						}
						if (flag.newUnitEffect !== undefined){
							const fleet = flag.side === game.BattleSide.attacker ? attackerFleet  : defenderFleet;
							
							applyContinuousEffectsOnUnits(fleet, flags[flag.side], flag.side, battleType, timing, options[flag.side]);

							game.fillOutFleet(fleet, battleType, options[flag.side]);
						}

					}
				}
				deadUnit.flagPointers=[];
			}

			for (var i = 0; i < deadUnitsDefender.length; i++) {
				const deadUnit = deadUnitsDefender[i];
				
				for (const flagPointer of deadUnit.flagPointers){
					const index = flags[flagPointer.side].indexOf(flagPointer);
					const flag = flags[flagPointer.side][index];
					
					if (index !== -1) {
						flags[flagPointer.side].splice(index,1);
						const ability = continuousUnitAbilities[flagPointer.name];
						if (ability && ability.deathEffect !== undefined){
							ability.deathEffect(deadUnit, defenderFleet, attackerFleet, battleType, options.defender, options.attacker, flags.defender, flags.attacker);
						}

						if (flag.newUnitEffect !== undefined){
							const fleet = flag.side === game.BattleSide.attacker ? attackerFleet : defenderFleet;
							applyContinuousEffectsOnUnits(fleet, flags[flag.side], flag.side, battleType, timing, options[flag.side]);

							game.fillOutFleet(fleet, battleType, options[flag.side]);

							
						}
					}
				}
				deadUnit.flagPointers=[];
				
			}

		}

		function assignHitsStep(attackerFleet, attackerHits, attackerHitsNonFighter, defenderFleet, defenderHits, defenderHitsNonFighter, attackerHardPredicate, attackerSoftPredicate, defenderHardPredicate, defenderSoftPredicate, resources, timing, options, accumulation, passmode=false){

			attackerHardPredicate = attackerHardPredicate || function (unit) {
				return true;
			};

			defenderHardPredicate = defenderHardPredicate || function (unit) {
				return true;
			};

			var attackerDeadUnits=[];
			var defenderDeadUnits=[];

			// defenderHits= applyDamage(attackerFleet, defenderHits, attackerHardPredicate, attackerSoftPredicate, attackerDeadUnits, options.attacker);

			// attackerHits = applyDamage(defenderFleet, attackerHits, defenderHardPredicate, defenderSoftPredicate, defenderDeadUnits, options.defender);

			var attackerPass = false;
			var defenderPass = false;
			var loops = 0;
			if (passmode) {
				
				while (!(attackerPass && defenderPass) && loops<10000){
					loops++;
					if (defenderHitsNonFighter > 0){
						const [attackerUnit, attackerIndex] = findUnit(attackerFleet, attackerHardPredicate, nonFighterShip);
						if (attackerUnit){
							attackerDeadUnits.push(attackerUnit);
							const output = hit(attackerUnit, attackerIndex, attackerFleet, resources.attacker, resources.defender, options.attacker, accumulation.attacker);
							defenderHitsNonFighter -= output[0];
							attackerHits += output[1];

							attackerPass=false;
							defenderPass=false;
						} else {
							attackerPass = true;
						}
					} else {
						attackerPass = true;
					}

					if (attackerPass && defenderPass) { break;}

					if (attackerHitsNonFighter > 0){
						const [defenderUnit, defenderIndex] = findUnit(defenderFleet, defenderHardPredicate, nonFighterShip);
						if (defenderUnit){
							defenderDeadUnits.push(defenderUnit);
							const output = hit(defenderUnit, defenderIndex, defenderFleet, resources.defender, resources.attacker, options.defender, accumulation.defender);
							attackerHitsNonFighter -= output[0];
							defenderHits += output[1];

							attackerPass=false;
							defenderPass=false;
						} else {
							defenderPass = true;
						}
					} else {
						defenderPass = true;
					}
					
				}

				var attackerPass = false;
				var defenderPass = false;

				
				while (!(attackerPass && defenderPass) && loops<10000){
					loops++;
					if (defenderHits > 0){
						const [attackerUnit, attackerIndex] = findUnit(attackerFleet, attackerHardPredicate, attackerSoftPredicate);
						if (attackerUnit){
							attackerDeadUnits.push(attackerUnit);
							const output = hit(attackerUnit, attackerIndex, attackerFleet, resources.attacker, resources.defender, options.attacker, accumulation.attacker);
							defenderHits -= output[0];
							attackerHits += output[1];

							attackerPass=false;
							defenderPass=false;
						} else {
							attackerPass = true;
						}
					} else {
						attackerPass = true;
					}

					if (attackerPass && defenderPass) { break;}

					if (attackerHits > 0){
						const [defenderUnit, defenderIndex] = findUnit(defenderFleet, defenderHardPredicate, defenderSoftPredicate);
						if (defenderUnit){
							defenderDeadUnits.push(defenderUnit);
							const output = hit(defenderUnit, defenderIndex, defenderFleet, resources.defender, resources.attacker, options.defender, accumulation.defender);
							attackerHits -= output[0];
							defenderHits += output[1];

							attackerPass=false;
							defenderPass=false;
						} else {
							defenderPass = true;
						}
					} else {
						defenderPass = true;
					}
					
				}
			} else {
				
				while (defenderHitsNonFighter > 0 && loops<10000){
					loops++;
					const [attackerUnit, attackerIndex] = findUnit(attackerFleet, attackerHardPredicate, nonFighterShip);
					if (attackerUnit){
						attackerDeadUnits.push(attackerUnit);
						const output = hit(attackerUnit, attackerIndex, attackerFleet, resources.attacker, resources.defender, options.attacker, accumulation.attacker);
						defenderHitsNonFighter -= output[0];		
					} else {
						break;
					}
				}
				
				while (defenderHits > 0 && loops<10000){
					loops++;
					const [attackerUnit, attackerIndex] = findUnit(attackerFleet, attackerHardPredicate, attackerSoftPredicate);
					if (attackerUnit){
						attackerDeadUnits.push(attackerUnit);
						const output = hit(attackerUnit, attackerIndex, attackerFleet, resources.attacker, resources.defender, options.attacker, accumulation.attacker);
						defenderHits -= output[0];
					} else {
						break;
					}
					
				}

				while (attackerHitsNonFighter > 0 && loops<10000){
					loops++;
					const [defenderUnit, defenderIndex] = findUnit(defenderFleet, defenderHardPredicate, nonFighterShip);
					if (defenderUnit){
						defenderDeadUnits.push(defenderUnit);
						const output = hit(defenderUnit, defenderIndex, defenderFleet, resources.defender, resources.attacker, options.defender, accumulation.defender);
						attackerHitsNonFighter -= output[0];
					} else {
						break
					}
				}

				while (attackerHits > 0 && loops<10000){
					loops++;
					const [defenderUnit, defenderIndex] = findUnit(defenderFleet, defenderHardPredicate, defenderSoftPredicate);
					if (defenderUnit){
						defenderDeadUnits.push(defenderUnit);
						const output = hit(defenderUnit, defenderIndex, defenderFleet, resources.defender, resources.attacker, options.defender, accumulation.defender);
						attackerHits -= output[0];
					} else {
						break;
					}
				}
			}

			if (loops >= 10000){
				print("ERROR error Loops Max Achieved assign hits")
			}

			return [attackerDeadUnits, defenderDeadUnits, attackerHits+attackerHitsNonFighter, defenderHits+defenderHitsNonFighter];

			function findUnit(fleet, hardPredicate, softPredicate){
				for (var i = fleet.length - 1; 0 <= i; i--) {
					const unit = fleet[i]
					if (hardPredicate(unit) && (!softPredicate || softPredicate(unit))) {
						return [unit,i]
					}
				}
				if (softPredicate) {
					for (var i = fleet.length - 1; 0 <= i; i--) {
						const unit = fleet[i];
						if (hardPredicate(unit)) {
							return [unit,i];
						}
					}
				}
				return [undefined, undefined]
			}
			
			function hit(unit, i, fleet, thisSideResources, otherSideResources, thisSideOptions, thisSideAccumulation) {

				var cancelled = 1;
				var added = 0;

				fleet.splice(i,1);

				if (unit.isDamageGhost) {
					[cancelled,added] = sustainDamageEffect(unit, fleet, thisSideResources, otherSideResources, timing, thisSideOptions, thisSideAccumulation);			
				}
				
				
				
				return [cancelled, added];
			}
			
		}

		function sustainDamageEffect(unit, fleet,  thisSideResources, otherSideResources, timing, thisSideOptions, thisSideAccumulation) {
			if (thisSideOptions.baronyCommander){
				thisSideAccumulation.tgsEarned++;
			}
			if (unit.damageCorporeal !== undefined) {
				unit.damageCorporeal.update({damaged:true, ghostCorporeal:undefined});
				
				if (checkTiming(timing, 'duringCombat_')) //edit this
					unit.damageCorporeal.update({sustainedThisRound: true});
			}
			

			return [thisSideOptions.nonEuclidean ? 2 : 1, 0];
		}



		function cancelHitsPassing(attackerFleet, defenderFleet, 
			attackerHardPredicate, attackerSoftPredicate, 
			defenderHardPredicate, defenderSoftPredicate,
			attackerHits, defenderHits,
			attackerHitsNonFighter, defenderHitsNonFighter, 
			attackerHitsRemainingSim, defenderHitsRemainingSim,
			attackerDeadUnits, defenderDeadUnits,
			attackerLost, defenderLost,
			resources, flags, timing, throwType, battleType, options, accumulation){

			
			

			var attackerPass = false;
			var defenderPass = false;

			var defenderHitsCancelled=0;
			var attackerHitsCancelled=0;

			const attackerOnce= new Set();
			const defenderOnce = new Set();

			var effAttackerSoftPredicate = attackerHitsNonFighter > 0 ? nonFighterShip : attackerSoftPredicate;
			var effDefenderSoftPredicate = defenderHitsNonFighter > 0 ? nonFighterShip : defenderSoftPredicate;

			var loops = 0
			while (!(attackerPass && defenderPass) && loops<10000){
				loops++;
				
				if (attackerDeadUnits.length > 0 && defenderHitsCancelled < defenderHits + defenderHitsNonFighter) {
					var attackerCancels=[];
					for (var i = 0; i < cancelHits.length; i++) {
						var cancelHit = cancelHits[i];
						if 	(
							cancelHit.condition(
								attackerFleet,
								Math.max(defenderHits + defenderHitsNonFighter-defenderHitsCancelled,0),
								defenderHitsRemainingSim,
								attackerLost,
								resources.attacker,
								flags.attacker,
								throwType, 
								battleType,
								attackerOnce) &&
							checkTiming(timing, cancelHit.timing)
							) {
								attackerCancels.push(cancelHit)
							}
					}

					for (var i = attackerFleet.length - 1; 0 <= i; i--) {
						const unit = attackerFleet[i];
						if (unit.isDamageGhost && attackerHardPredicate(unit) && (!effAttackerSoftPredicate || effAttackerSoftPredicate(unit))){
							const output = {
								name:'sustainDamage',
								effect: function(){
									attackerFleet.splice(attackerFleet.indexOf(unit),1);
									return sustainDamageEffect(unit, attackerFleet, resources.attacker, resources.defender, timing, options.attacker,accumulation.attacker);
									
									
								},
								priority: 0 + options.attacker.duraniumArmor + options.attacker.nonEuclidean,
							}
							attackerCancels.push(output);
						}
					}
					if (effAttackerSoftPredicate){
						for (var i = attackerFleet.length - 1; 0 <= i; i--) {
							const unit = attackerFleet[i];
							if (unit.isDamageGhost && attackerHardPredicate(unit)){
								const output = {
									name:'sustainDamage',
									effect: function(){
										attackerFleet.splice(attackerFleet.indexOf(unit),1);
										return sustainDamageEffect(unit, attackerFleet, resources.attacker, resources.defender, timing, options.attacker,accumulation.attacker);
									},
									priority: 0 + options.attacker.duraniumArmor + options.attacker.nonEuclidean,
								}
								attackerCancels.push(output);
							}
						}
					}
					
					// if (printB){
					// 	print(attackerCancels);
					// }
					

					const attackerCancel = attackerCancels.length === 0
						? undefined
						: attackerCancels.reduce((bestSoFar, cur) =>
							cur.priority > bestSoFar.priority ? cur : bestSoFar);

					if (attackerCancel) {
						const output = attackerCancel.effect(attackerFleet, resources.attacker, resources.defender,  flags.attacker, timing, options.attacker, accumulation.attacker);
						defenderHitsCancelled += output[0];
						attackerHits += output[1];
						attackerOnce.add(attackerCancel.name);
						attackerPass=false;
						defenderPass=false;

						if (defenderHitsCancelled >= defenderHitsNonFighter){
							effAttackerSoftPredicate = attackerSoftPredicate;
						}
					} else {
						attackerPass=true;
					}

				} else {
					attackerPass = true;
				}



				if (attackerPass && defenderPass) { break;}

				if (defenderDeadUnits.length > 0 && attackerHitsCancelled < attackerHits + attackerHitsNonFighter) {
					var defenderCancels=[];
					for (var i = 0; i < cancelHits.length; i++) {
						var cancelHit = cancelHits[i];
						if 	(
							cancelHit.condition(
								defenderFleet,
								Math.max(attackerHits + attackerHitsNonFighter-attackerHitsCancelled,0), 
								attackerHitsRemainingSim,
								defenderLost,
								resources.defender,
								flags.defender,
								throwType, 
								battleType, 
								defenderOnce) &&
							checkTiming(timing, cancelHit.timing)
							) {
								defenderCancels.push(cancelHit);
							}
					}

					for (var i = defenderFleet.length - 1; 0 <= i; i--) {
						const unit = defenderFleet[i];
						if (unit.isDamageGhost && defenderHardPredicate(unit) && (!effDefenderSoftPredicate || effDefenderSoftPredicate(unit))){
							const output = {
								name:'sustainDamage',
								effect: function(){
									defenderFleet.splice(defenderFleet.indexOf(unit),1);
									return sustainDamageEffect(unit, defenderFleet, resources.defender, resources.attacker, timing,  options.defender,accumulation.defender);
								},
								priority: 0 + options.defender.duraniumArmor + options.defender.nonEuclidean,
							}
							defenderCancels.push(output);
						}
					}
					if (effDefenderSoftPredicate){
						for (var i = defenderFleet.length - 1; 0 <= i; i--) {
							const unit = defenderFleet[i];
							if (unit.isDamageGhost && defenderHardPredicate(unit)){
								const output = {
									name:'sustainDamage',
									effect: function(){
										defenderFleet.splice(defenderFleet.indexOf(unit),1);
										return sustainDamageEffect(unit, defenderFleet, resources.defender, resources.attacker, timing, options.defender,accumulation.defender);
									},
									priority: 0 + options.defender.duraniumArmor + options.defender.nonEuclidean,
								}
								defenderCancels.push(output);
							}
						}
					}

					

					const defenderCancel = defenderCancels.length === 0
						? undefined
						: defenderCancels.reduce((bestSoFar, cur) =>
							cur.priority > bestSoFar.priority ? cur : bestSoFar);

					if (defenderCancel) {
						const output = defenderCancel.effect(defenderFleet, resources.defender, resources.attacker, flags.defender, timing, options.defender, accumulation.defender);
						

						attackerHitsCancelled += output[0];
						defenderHits += output[1];

						defenderOnce.add(defenderCancel.name);
						attackerPass=false;
						defenderPass=false;

						if (attackerHitsCancelled >= attackerHitsNonFighter){
							effDefenderSoftPredicate = defenderSoftPredicate;
						}

					} else {
						defenderPass=true;
					}
				} else {
					defenderPass = true;
				}
			}


			// if (printB){
			// 	print([attackerHitsCancelled, defenderHitsCancelled, attackerHits,  defenderHits]);
			// 	print(attackerFleet);
			// }


			return [attackerHitsCancelled, defenderHitsCancelled, attackerHits,  defenderHits];


		}

		// function takeHits(attacker, defender, attackerHits, defenderHits, attackerInflictedSpecial, defenderInflictedSpecial, attackerSpent, defenderSpent, resources, flags, flagsToAdd, throwType, timing, battleType, accumulation, options, passThrough, noSim=false){


		function takeHits(state, attackerHits, defenderHits, attackerInflictedSpecial, defenderInflictedSpecial, attackerSpent, defenderSpent, flagsToAdd, throwType, battleType, accumulation, options, passThrough=false, noSim=false){

			var attacker = state.attacker;
			var defender = state.defender;
			var resources = state.resources;
			var flags = state.flags;
			var timing = state.timing;

			var attackerClone = attacker;
			var defenderClone = defender;
			var resClone = resources;
			var flagsClone = flags;
			var accClone = accumulation;
			
			if (passThrough === undefined || !passThrough) {
				[attackerClone,defenderClone,flagsClone] = cloneFleetsAndFlags(attacker,defender,flags);
				resClone = resourcesClone(resources);
				// resClone = structuredClone(resources);
				accClone = {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0};
			}

			

			

			accClone.attacker.tgsSpent += attackerSpent;
			accClone.defender.tgsSpent += defenderSpent;
			if (resClone.attacker.tgs) resClone.attacker.tgs.total = Math.max(resClone.attacker.tgs.total - attackerSpent,0);
			if (resClone.defender.tgs) resClone.defender.tgs.total = Math.max(resClone.defender.tgs.total-defenderSpent,0);


			if (flagsToAdd && flagsToAdd.attacker){
				flagsClone.attacker.push({
					name:flagsToAdd.attacker.name,
					shortType:flagsToAdd.attacker.shortType,
					duration:flagsToAdd.attacker.duration,
				})
			}
			if (flagsToAdd && flagsToAdd.defender){
				flagsClone.defender.push({
					name:flagsToAdd.defender.name,
					shortType:flagsToAdd.defender.shortType,
					duration:flagsToAdd.defender.duration,
				})
			}



			var newState = {
				attacker: attackerClone,
				defender: defenderClone,
				resources: resClone,
				flags: flagsClone,
				startKey: undefined,
				timing: state.timing,
				prob: 0,
				turn: 'attacker',
				transitionArray: null,
				nextStates: null, 
				terminal: false,
				
			}






			var hardPredicate = function(unit) {
				return unit.cancelHit ? false : (throwType === game.ThrowType.Barrage ? unit.type === game.UnitType.Fighter : true);
			};

			var attackerHitsNonFighter = attackerInflictedSpecial; 
			var defenderHitsNonFighter = defenderInflictedSpecial;

			var attackerSustainHardPredicate = hardPredicate;
			var defenderSustainHardPredicate = hardPredicate;

			var attackerDeadSim = [];
			var defenderDeadSim = [];
			var attackerHitsRemainingSim = 0;
			var defenderHitsRemainingSim = 0;

			var attackerLostSim = false;
			var defenderLostSim = false;

			// noSim = true;

			if (noSim === undefined || !noSim) {
				[,,,,,attackerDeadSim, defenderDeadSim,attackerHitsRemainingSim, defenderHitsRemainingSim, attackerLostSim, defenderLostSim] = takeHits(newState, attackerHits, defenderHits, attackerHitsNonFighter, defenderHitsNonFighter, 0, 0,  undefined, throwType,  battleType, accClone, options, false, true);

				// print(''+ attackerHits + defenderHits)
				// print(attackerClone);

				attackerSustainHardPredicate = makeSustainHardPredicate(attackerDeadSim, hardPredicate);
				defenderSustainHardPredicate = makeSustainHardPredicate(defenderDeadSim, hardPredicate);

				

				[attackerHitsCancelled, defenderHitsCancelled, attackerHits, defenderHits] = cancelHitsPassing(
					attackerClone, defenderClone, 
					attackerSustainHardPredicate, undefined, 
					defenderSustainHardPredicate, undefined, 
					attackerHits, defenderHits,
					attackerHitsNonFighter,defenderHitsNonFighter, 
					attackerHitsRemainingSim, defenderHitsRemainingSim,
					attackerDeadSim, defenderDeadSim,
					attackerLostSim, defenderLostSim,
					resClone, flagsClone, timing, throwType, battleType, options, accClone);

				// print(attackerClone);
				// print(''+ attackerHitsCancelled + defenderHitsCancelled)
				// print(''+ attackerHits + defenderHits)
				// print('done');

				attackerHits =  Math.max(attackerHits - Math.max(attackerHitsCancelled-attackerHitsNonFighter,0),0);
				attackerHitsNonFighter = Math.max(attackerHitsNonFighter-attackerHitsCancelled,0);
				
				defenderHits =  Math.max(defenderHits - Math.max(defenderHitsCancelled-defenderHitsNonFighter,0),0);
				defenderHitsNonFighter = Math.max(defenderHitsNonFighter-defenderHitsCancelled,0);
				
				
			}


			

			

			const [attackerDeadUnits, defenderDeadUnits, attackerHitsRemaining, defenderHitsRemaining] = assignHitsStep(attackerClone, attackerHits, attackerHitsNonFighter, defenderClone, defenderHits, defenderHitsNonFighter, hardPredicate, undefined, hardPredicate, undefined, resClone, timing, options, accClone, noSim);

			resolveDead(attackerDeadUnits, defenderDeadUnits, attackerClone, defenderClone, battleType, flagsClone, timing, options);

			const attackerLost = fleetLength(attackerClone) === 0;
			const defenderLost = fleetLength(defenderClone) === 0;

			// const attackerLost = false;
			// const defenderLost = false;

			return [attackerClone, defenderClone, resClone, flagsClone, accClone, attackerDeadUnits, defenderDeadUnits, attackerHitsRemaining, defenderHitsRemaining, attackerLost, defenderLost];


		}

		

		

		function checkTiming(combatTiming, abilityTiming, strict){
			
			

			if (combatTiming === abilityTiming) {
				return true;
			}

			if (abilityTiming === '_'){
				return true
			}

			if (abilityTiming.includes("_")) {
				const [startTiming, endTiming] = abilityTiming.split("_");
				var startIndex = startTiming
					? timingsOrder.indexOf(startTiming)
					: 0;
				var endIndex = endTiming
					? timingsOrder.indexOf(endTiming)
					: timingsOrder.length - 1;
				const combatIndex = timingsOrder.indexOf(combatTiming);

				if (strict){ // not really sure what this is used for, other that to basically igore the _
					if (startTiming){
						endIndex = startIndex
					} else {
						startIndex = 0;
						endIndex = 0;
					}
				}

				if (combatIndex !== -1 && startIndex !== -1 && endIndex !== -1) {
					const min = Math.min(startIndex, endIndex);
					const max = Math.max(startIndex, endIndex);

					if (combatIndex >= min && combatIndex <= max) {
						return true;
					}
				}
			}

			if (TIMING_PARENTS[combatTiming]){
				for (const parent of TIMING_PARENTS[combatTiming]){
					if (combatTiming !== parent){
						if (checkTiming(parent, abilityTiming))
							return true;
					}
					
				}
			}
			return false;
		}

		function matrixToStates(state, attackerTransitions3D, defenderTransitions3D, flagsToAdd, accumulations, throwType, battleType, options, elapsedMili){

			// const transitionMatrix = orthogonalMultiplyMatrixSpecial(attackerTransitions,defenderTransitions, attackerTransitionsSpecial,defenderTransitionsSpecial); 



			

			const transitionMatrix = orthogonalMultiplyMatrix3DSpecial( attackerTransitions3D, defenderTransitions3D);

			

			

			// print(transitionMatrix);
			// print(transitionMatrix.rows);
			// print(transitionMatrix.columns);
			// print(transitionMatrix.dim3);
			// print(transitionMatrix.dim4);


			var transitionArray=[];
			var newStatesArray=[];
			var rewardsArray = [];

			const isCombatRolls = state.timing === 'combatRolls';
			const isCombat = checkTiming(state.timing, 'duringCombat', true);
			const isBarrage = state.timing === 'barrage';

			

			let totalBelow = 0;
			let tick = 0;
			for (let i = 0; i < transitionMatrix.rows; i++) {
				
				for (let j = 0; j < transitionMatrix.columns; j++) {
					
					for (let k = 0; k < transitionMatrix.dim3; k++) {
						
						for (let l = 0; l < transitionMatrix.dim4; l++) {
							var col = transitionMatrix[i][j][k][l]
							const v = col.reduce((sum, arr) => sum + arr.reduce((s, x) => s + x, 0), 0);

							if (v < elapsedMili**3/1e13) {
							
								totalBelow += v;
								
								tick++;

								const zeros = col.map(inner => inner.map(() => 0));
          						col = zeros;
							}
						}
					}
				}
			}

			var scale=1
			if (tick == (transitionMatrix.rows*transitionMatrix.columns * transitionMatrix.dim3 * transitionMatrix.dim4)){
			
				console.log('trigger');
				transitionMatrix[transitionMatrix.rows-1][transitionMatrix.columns-1][transitionMatrix.dim3-1][transitionMatrix.dim4-1][transitionMatrix.dim5-1][0] = 1;
				scale = 1; 
			} else {
				scale = 1/(1-totalBelow);
			}
			

			const stateIndexMap = new Map();
			var majorityIndex = 0;
			var majorityInflicted = [0,0,0,0];
			// var majorityAttackerInflicted = 0;
			// var majorityDefenderInflicted = 0;
			// var majorityAttackerInflicted = 0;
			// var majorityDefenderInflicted = 0;


			for (let attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
				for (let defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
					for (let attackerInflictedSpecial = 0; attackerInflictedSpecial < transitionMatrix.dim3; attackerInflictedSpecial++){
						for (let defenderInflictedSpecial = 0; defenderInflictedSpecial < transitionMatrix.dim4; defenderInflictedSpecial++){

						for (let attackerSpent = 0; attackerSpent < transitionMatrix.dim5; attackerSpent++){
						for (let defenderSpent = 0; defenderSpent < transitionMatrix.dim6; defenderSpent++){

							// prob = transitionMatrix.at(attackerInflicted, defenderInflicted);
							var prob = transitionMatrix[attackerInflicted][defenderInflicted][attackerInflictedSpecial][defenderInflictedSpecial][attackerSpent][defenderSpent] * scale;
							if (prob === 0){ continue;}
							
							
							
							
							[attackerClone, defenderClone, rClone, fClone, aClone]=takeHits(state,attackerInflicted, defenderInflicted, attackerInflictedSpecial, defenderInflictedSpecial, attackerSpent, defenderSpent, flagsToAdd, throwType, battleType, accumulations, options, false);

							


							if (isCombatRolls){
								if (options.attacker.duraniumArmor){
									duraniumArmorRepair(attackerClone,battleType, fClone.attacker, options.attacker);
								}
								if (options.defender.duraniumArmor) {
									duraniumArmorRepair(defenderClone,battleType, fClone.defender, options.defender);
								}

								
							}


							
							
							
							var thisKey = buildStateKey(attackerClone, defenderClone, rClone, fClone);

							if (stateIndexMap.has(thisKey)) {
								const idx = stateIndexMap.get(thisKey);
								transitionArray[idx] += prob;

							} else {

								rewardsArray.push(aClone);
								transitionArray.push(prob);

								const thisIndex = newStatesArray.length;
								stateIndexMap.set(thisKey, thisIndex);
								
								
								var newState = {
									attacker: attackerClone,
									defender: defenderClone,
									resources: rClone,
									flags: fClone,
									startKey: thisKey,
									timing: state.timing,
									prob: 0,
									turn: state.turn,
									
									transitionArray: null, // will be filled when processed
									nextStates: null,       // will be filled when processed
									// accumulations: aClone,
									terminal: false,
									
								}
								newStatesArray.push(newState);
							}

							const thatKey = stateIndexMap.get(thisKey);
							if (prob > 0.99999 || transitionArray[thatKey] > 0.99999){
								majorityIndex = thatKey;
								majorityInflicted = [attackerInflicted,defenderInflicted, attackerInflictedSpecial, defenderInflictedSpecial, attackerSpent, defenderSpent];
								break;
							}
						}
						}
						}
					}
				}
			}

			// state.transitionArray = transitionArray;
			// state.nextStates = newStatesArray;
			
			if (transitionArray[majorityIndex] > 0.99999){


				[attackerClone, defenderClone, rClone, fClone, aClone]=takeHits(state, ...majorityInflicted, flagsToAdd, throwType, battleType, accumulations, options, true);

				

				

				if (isCombat){
					if (options.attacker.duraniumArmor){
						duraniumArmorRepair(attackerClone,battleType, fClone.attacker, options.attacker);
					}
					if (options.defender.duraniumArmor) {
						duraniumArmorRepair(defenderClone,battleType, fClone.defender, options.defender);
					}

					
				}

				
				rewardsArray=[aClone];
				newStatesArray = [];
				state.flags = fClone;
				transitionArray=[1];
			}

			return [transitionArray, newStatesArray, rewardsArray,  false];

		}

		

		function runRandomTestCases(numCases = 5, maxUnits = 5, maxDice = 5, alpha = 1e-3) {
			const dieSides = 10;
			const N = 1000000; // must match the rolls used in test()

			function randomBool() { return Math.random() < 0.5; }
			function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

			function erf(x) {
				const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
				const sign = x < 0 ? -1 : 1;
				const ax = Math.abs(x);
				const t = 1.0 / (1.0 + p * ax);
				const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
				return sign * y;
			}
			function normalCdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
			function normalSurvival(z) { return 1 - normalCdf(z); }

			function poissonTailGE(k, mu) {
				if (k <= 0) return 1.0;
				let term = Math.exp(-mu);
				let sum = term;
				for (let i = 1; i < k; i++) {
				term *= mu / i;
				sum += term;
				if (1 - sum < 1e-15) return 0.0;
				}
				return Math.max(0, 1 - sum);
			}

			function binomialTailProb(kObs, p, N) {
				const mu = p * N;
				if (p <= 0) return kObs > 0 ? 0.0 : 1.0;
				if (p >= 1) return kObs < N ? 0.0 : 1.0;
				if (kObs >= mu) {
				if (mu < 50) return poissonTailGE(kObs, mu);
				const sigma = Math.sqrt(N * p * (1 - p));
				const z = (kObs - 0.5 - mu) / sigma;
				return normalSurvival(z);
				} else {
				const kSym = N - kObs;
				const pSym = 1 - p;
				const muSym = pSym * N;
				if (muSym < 50) return poissonTailGE(kSym, muSym);
				const sigma = Math.sqrt(N * pSym * (1 - pSym));
				const z = (kSym - 0.5 - muSym) / sigma;
				return normalSurvival(z);
				}
			}

			for (let c = 0; c < numCases; c++) {
				const numUnits = randomInt(1, maxUnits);
				var units = [];
				for (let u = 0; u < numUnits; u++) {
				units.push({
					battleValue: randomInt(1, dieSides),
					dice: randomInt(1, maxDice),
					hitsPerDie: randomInt(1, 3),
					rerolls: randomInt(0, 2),
					bonus10: randomBool(),
					jolnar: randomBool(),
					meld: randomBool(),
					immuneCrown: randomBool(),
					special: randomBool(),
					argent: randomBool(),
				});
				}

				var crown = randomBool();
				var plasma = randomBool();
				var hacans = randomInt(0, 3);

				const simOutput = test(units, crown, plasma, hacans);
				// const simProb2D = simOutput[0];
				// const simSpend2D = simOutput[1];
				const simProb3D = simOutput[2];

				const exactOutput = exact(units, crown, plasma, hacans);
				// const exactProb2D = exactOutput[0];
				// const exactSpend2D = exactOutput[1];
				// const exactProb3D = exactOutput[2];
				const exactProb3D = exactOutput;

				// const maxN = Math.max((simProb2D ? simProb2D.length - 1 : 0), (exactProb2D ? exactProb2D.length - 1 : 0), 0);
				// let maxSp = 0;
				// for (const M of [simProb2D, exactProb2D]) {
				// for (let i = 0; i < (M ? M.length : 0); i++) {
				// 	if (M[i]) maxSp = Math.max(maxSp, M[i].length - 1);
				// }
				// }

				const maxN3 = Math.max((simProb3D ? simProb3D.length - 1 : 0), (exactProb3D ? exactProb3D.length - 1 : 0), 0);
				let maxSp3 = 0, maxS3 = 0;
				for (const A of [simProb3D, exactProb3D]) {
					if (!A) continue;
					for (let i = 0; i < A.length; i++) {
						const row = A[i] || [];
						maxSp3 = Math.max(maxSp3, row.length - 1);
						for (let j = 0; j < row.length; j++) {
							const col = row[j] || [];
							maxS3 = Math.max(maxS3, col.length - 1);
						}
					}
				}

				const hitFailures2D = [];
				const spendFailures = [];

				// for (let n = 0; n <= maxN; n++) {
				// 	for (let sp = 0; sp <= maxSp; sp++) {
				// 		const pSim = ((simProb2D[n] || [])[sp]) || 0;
				// 		const pEx = ((exactProb2D[n] || [])[sp]) || 0;
				// 		const kObs = Math.round(pSim * N);
				// 		const hitP = binomialTailProb(kObs, pEx, N);
				// 		if (hitP < alpha && kObs > 0) hitFailures2D.push({ n, sp, pSim, pEx, kObs, pTail: hitP });

				// 		const simSpendVal = ((simSpend2D[n] || [])[sp]) || 0;
				// 		const exactSpendVal = ((exactSpend2D[n] || [])[sp]) || 0;
				// 		const expectedCount = Math.round(pEx * N);
				// 		if (expectedCount > 0 && (simProb2D[n] && simProb2D[n][sp])) {
				// 		const sigma = 1.0 / Math.sqrt(expectedCount);
				// 		const z = Math.abs(simSpendVal - exactSpendVal) / sigma;
				// 		const spendP = normalSurvival(z);
				// 		if (spendP < (alpha * 1e-2)) {
				// 			spendFailures.push({ n, sp, simSpendVal, exactSpendVal, expectedCount, z, pTail: spendP });
				// 		}
				// 		}
				// 	}
				// }

				const hitFailures3D = [];
				for (let n = 0; n <= maxN3; n++) {
					for (let sp = 0; sp <= maxSp3; sp++) {
						for (let s = 0; s <= maxS3; s++) {
							const pSim = (((simProb3D || [])[n] || [])[sp] || [])[s] || 0;
							const pEx = (((exactProb3D || [])[n] || [])[sp] || [])[s] || 0;
							const kObs = Math.round(pSim * N);
							const hitP = binomialTailProb(kObs, pEx, N);
							if (hitP < alpha && kObs > 0) {
								hitFailures3D.push({ n, sp, s, pSim, pEx, kObs, pTail: hitP });
							}
						}
					}
				}

				console.log(`==== Random Test Case ${c + 1} ====`);
				console.log("Units:", units);
				console.log("Crown:", crown, "Plasma:", plasma, "Hacans:", hacans);

				// console.log("Simulation prob matrix (2D):", simProb2D);
				// console.log("Exact prob matrix (2D):     ", exactProb2D);
				// console.log("Simulation spend matrix (conditional):", simSpend2D);
				// console.log("Exact spend matrix (conditional):    ", exactSpend2D);

				console.log("Simulation prob 3D array:", simProb3D);
				console.log("Exact prob 3D array:", exactProb3D);
				

				if (hitFailures2D.length === 0 && spendFailures.length === 0 && hitFailures3D.length === 0) {
				console.log("✅ Test PASSED\n");
				} else {
				console.log("❌ Test FAILED");
				if (hitFailures2D.length) console.log("Hit cell failures (2D):", hitFailures2D);
				if (spendFailures.length) console.log("Spend cell failures:", spendFailures);
				if (hitFailures3D.length) {
					console.log(`Hit cell failures (3D): ${hitFailures3D.length} cells:`, hitFailures3D.slice(0, 200));
					if (hitFailures3D.length > 200)
					console.log(`... and ${hitFailures3D.length - 200} more (truncated)`);
				}
				console.log("\n");
				}
			}
		}




		


		function propagateProbabilityAllDirections_hashtable(battleType, options, input) {


			
			
			
			// var attackerFull = game.expandFleet(input, game.BattleSide.attacker);
			// var defenderFull = game.expandFleet(input, game.BattleSide.defender);
			// var attacker = attackerFull.filterForBattle();
			// var defender = defenderFull.filterForBattle();

			// var A = [
			// 	{battleValue: 5, dice: 2, hitsPerDie:2, rerolls: 0, bonus10: false, jolnar: false, immuneCrown:true,special:false, meld:true, argent: true},
			// 	// {battleValue: 3, dice: 2, hitsPerDie:2, rerolls: 2, bonus10: false, jolnar: true, immuneCrown:false,special:false, meld:false, argent: true},
			// 	// {battleValue: 10, dice: 2, hitsPerDie:2, reroll: 2, bonus10: true, jolnar: true, }
			// ]
			// // var A = [
			// // 	{battleValue: 8, dice: 2, hitsPerDie:1, rerolls: 0, bonus10: false, jolnar: false, meld:true},
			// // 	// {battleValue: 6, dice: 3, hitsPerDie:1, rerolls: 0, bonus10: true, jolnar: false, },
			// // 	// {battleValue: 10, dice: 1, hitsPerDie:3, reroll: false, bonus10: false, jolnar: false, }
			// // ]
			// var crown = false;
			// var plasma = false;
			// var hacans = 0;

			// const output = test(A, crown, plasma, hacans);
			// print(output[2].map(row => row.map(col => col[0])));

			// const output2 = exact(A, crown, plasma, hacans);
			// print(output2.map(row => row.map(col => col[0])));

			// runRandomTestCases(1000, 3, 3, 1e-4);

			// var A = [
			// 	{battleValue: 5, dice: 7, hitsPerDie:2, reroll: false, bonus10: true, jolnar: false, },
			// 	// {battleValue: 7, dice: 1, hitsPerDie:1, reroll: false, bonus10: true, jolnar: true, },
			// 	// {battleValue: 10, dice: 1, hitsPerDie:3, reroll: false, bonus10: false, jolnar: false, }
			// ]

			// const output3 = exact(A, false, false, 2);
			// print(output2);
			

			var attackerFull = cloneFleet(input.unitsFull.attacker);
			var defenderFull = cloneFleet(input.unitsFull.defender);

			applyContinuousEffectsOnUnits(attackerFull, [], game.BattleSide.attacker, battleType, 'beforeCombat', options.attacker);
			applyContinuousEffectsOnUnits(defenderFull, [], game.BattleSide.defender, battleType, 'beforeCombat', options.defender);

			print(attackerFull);
			print(defenderFull);
			print(options.attacker);
			print(options.defender);
			

			var attacker;
			var attackerNotParticipating;
			var defender;
			var defenderNotParticipating;
			[attacker,attackerNotParticipating] = game.filterFleet(attackerFull, battleType, 'attacker', options.attacker);
			[defender, defenderNotParticipating] = game.filterFleet(defenderFull, battleType, 'defender', options.defender);

			game.fillOutFleet(attacker, battleType,  options.attacker);
			game.fillOutFleet(defender, battleType,  options.defender);

			// print(defender);

			

			// const output3 = computeFleetTransitionsWrapper(attacker, defender, 'attacker', 'Space', {
			// 	meld:{
			// 		total: 1
			// 	}
			// }, game.ThrowType.Battle,[],options.attacker);
			// print(output3);
			// print(output3[0][1][0]);



			

			var explorationMap = new Map();
			var states = new Map();
			

			

			

			
			


			function abilityPassing(state, battleType, accumulation){
				var attackerPass = false;
				var defenderPass = false;

				const usedAttackerNotParticipating = cloneFleet(attackerNotParticipating);
				const usedDefenderNotParticipating = cloneFleet(defenderNotParticipating);

				state.turn = state.turn || 'attacker';
				var loops = 0
				while (!(attackerPass && defenderPass) && loops<10000){
					loops++;
					if (state.turn === 'attacker'){
						var attackerAbilities=[];
						for (var i = 0; i < activations.length; i++) {
							
							if (activations[i].condition(state.attacker, state.defender, 'attacker', battleType, state.resources.attacker, state.flags.attacker, options.attacker) && checkTiming(state.timing, activations[i].timing)){
								
								attackerAbilities.push(activations[i]);
							}
							
						}
						const abilityToUnit = new Map();
						for (var i = 0; i < state.attacker.length; i++) {
							const unit = state.attacker[i];
							for (var j = 0; j < unit.abilities.length; j++) {
								const abilityName = unit.abilities[j];
								const ability = continuousUnitAbilities[abilityName];
								if 	(ability && 
									 
									checkTiming(state.timing, ability.timing) && 
									!unit.flagPointers.some(item => item.name === abilityName) &&
									ability.condition(state.attacker, state.defender, 'attacker', battleType, state.resources.attacker, state.flags.attacker, unit, options.attacker)
								){
									abilityToUnit.set(ability,unit);
									attackerAbilities.push(ability);
								}
							}
						}

						for (var i = 0; i < usedAttackerNotParticipating.length; i++) {
							const unit = usedAttackerNotParticipating[i];

							for (var j = 0; j < unit.abilities.length; j++) {
								const abilityName = unit.abilities[j];
								const ability = continuousUnitAbilities[abilityName];

								if 	(ability && 
									 
									checkTiming(state.timing, ability.timing, true) && 
									!unit.flagPointers.some(item => item.name === abilityName) &&
									ability.condition(state.attacker, state.defender, 'attacker', battleType, state.resources.attacker, state.flags.attacker, unit, options.attacker)
								){
									abilityToUnit.set(ability,unit)
									attackerAbilities.push(ability);
								}
							}
						}

						var attackerAbility = attackerAbilities.sort((a, b) => b.priority - a.priority)[0];
						if (attackerAbility) {

							
							
							const output = attackerAbility.effect(state.attacker,state.defender, 'attacker', battleType, state.resources.attacker, state.flags.attacker, state.flags.defender, options, abilityToUnit.get(attackerAbility), state, accumulation);

							attackerPass=false;
							defenderPass = false;
							state.turn = 'defender';

							if (output){
								return output
							}
							
						} else {
							attackerPass=true;
							state.turn = 'defender';
						}
						// print(state.attacker[0].flagPointers[0] === state.flags.defender[1]);
						// print(state.flags.defender);
					}

					if (attackerPass && defenderPass) { break;}
					
					if (state.turn === 'defender'){
						var defenderAbilities=[];
						for (var i = 0; i < activations.length; i++) {
							if (activations[i].condition(state.defender,state.attacker, 'defender', battleType, state.resources.defender, state.flags.defender, options.defender) && checkTiming(state.timing, activations[i].timing)){
								// print(activations[i].name);
								// print(flags.defender);
								defenderAbilities.push(activations[i]);
							}
							
						}

						const abilityToUnit = new Map();
						for (var i = 0; i < state.defender.length; i++) {
							const unit = state.defender[i];
							for (var j = 0; j < unit.abilities.length; j++) {
								const abilityName = unit.abilities[j];
								const ability = continuousUnitAbilities[abilityName];
								// print(state.timing);
								// if (state.timing === 'spaceCannonDefense'){
								// 	print(abilityName);
								// 	print((ability))
								// 	print (checkTiming(state.timing, ability.timing))
								// 	print (!unit.flagPointers.some(item => item.name === abilityName))
								// 	print(ability.condition(state.defender,state.attacker, 'defender', battleType, state.resources.defender, state.flags.defender, unit, options.defender))

								// 	print('done');
								// }
								if 	(ability && 
									checkTiming(state.timing, ability.timing) &&
									!unit.flagPointers.some(item => item.name === abilityName) &&
									ability.condition(state.defender,state.attacker, 'defender', battleType, state.resources.defender, state.flags.defender, unit, options.defender)
								){
									print('trigger')
									abilityToUnit.set(ability,unit);
									defenderAbilities.push(ability);
								}
							}
						}
						for (var i = 0; i < usedDefenderNotParticipating.length; i++) {
							const unit = usedDefenderNotParticipating[i];
							for (var j = 0; j < unit.abilities.length; j++) {
								const abilityName = unit.abilities[j];
								const ability = continuousUnitAbilities[abilityName];
								if 	(ability &&
									
									checkTiming(state.timing, ability.timing, true) &&
									!unit.flagPointers.some(item => item.name === abilityName) &&
									ability.condition(state.defender,state.attacker, 'defender', battleType, state.resources.defender, state.flags.defender, unit, options.defender)
								){
									abilityToUnit.set(ability,unit);
									defenderAbilities.push(ability);
								}
							}
						}

						var defenderAbility = defenderAbilities.sort((a, b) => b.priority - a.priority)[0];
						if (defenderAbility) {


							const output = defenderAbility.effect(state.defender,state.attacker, 'defender', battleType, state.resources.defender, state.flags.defender, state.flags.attacker, options, abilityToUnit.get(defenderAbility), state, accumulation);


							attackerPass = false;
							defenderPass = false;
							state.turn = 'defender';

							if (output){
								return output
							}

							state.turn = 'attacker';

						} else {
							defenderPass=true;
							state.turn = 'attacker';
						}
					}
				}
				
				if (loops >= 10000){
					print('Loop MAXIMUM achieved abilitity passing!')
				}
				
			}

			

			

			function runState(state, accumulations, elapsedMili) {
				
				
				var outcome = [[1], [], [], false];
				switch (state.timing) {
					case "beforeCombat":

						var output = abilityPassing(state, battleType, accumulations);
						if (output){
							return output;
						}

						state.timing = 'spaceCannonOffense';
						break;
					
					case 'spaceCannonOffense':



						if (!state.flags.attacker.some(obj => obj.name == 'spaceCannonOffense') && battleType === 'Space'){

							const filter = function(unit){
								return !unit.notInSystem || unit.abilities.includes("longSpaceCannon");
							}

							const attackerFull = state.attacker.concat(attackerNotParticipating).filter(filter);
							const defenderFull = state.defender.concat(defenderNotParticipating).filter(filter);

							const attackerTransitions3D = getSpaceCannonTransition(attackerFull, defenderFull, 'attacker', battleType, state.resources.attacker,state.flags.attacker, options.attacker);
							const defenderTransitions3D  =  getSpaceCannonTransition(defenderFull,attackerFull, 'defender', battleType, state.resources.defender,state.flags.defender, options.defender);

							
							

					

							var flagsToAdd = {attacker:undefined, defender:undefined};
							flagsToAdd.attacker = {
								name: 'spaceCannonOffense',
								shortType: 'SPO',
								duration: -1,
							};
							flagsToAdd.defender = {
								name: 'spaceCannonOffense',
								shortType: 'SPO',
								duration: -1,
							};

							
							
							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, accumulations, game.ThrowType.SpaceCannon, battleType,  options, elapsedMili);

							

							return outcome;
						}

						state.timing = 'bombardment';
						break;
					case 'bombardment':

						

						if (!state.flags.attacker.some(obj => obj.name == 'bombardment') && battleType === 'Ground'){

							const filter = function(unit){
								return !unit.notInSystem;
							}

							const attackerFull = state.attacker.concat(attackerNotParticipating).filter(filter);
							const defenderFull = state.defender.concat(defenderNotParticipating);

							const attackerTransitions3D = getBombardmentTransition(attackerFull, defenderFull, 'attacker', battleType, state.resources.attacker,state.flags.attacker, options.attacker);
							const defenderTransitions3D  =  [[[1]]];

							
							

					

							var flagsToAdd = {attacker:undefined, defender:undefined};
							flagsToAdd.attacker={
								name: 'bombardment',
								shortType: 'BOM',
								duration: -1,
							};

							
							
							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, accumulations, game.ThrowType.Bombardment, battleType,  options, elapsedMili);

							

							return outcome;
						}

						state.timing = 'spaceCannonDefense';
						break;
					case 'spaceCannonDefense':

						var output = abilityPassing(state, battleType, accumulations);
						if (output){
							return output;
						}

						if (!state.flags.defender.some(obj => obj.name == 'spaceCannonDefense') && battleType === 'Ground'){

							const attackerFull = state.attacker.concat(attackerNotParticipating);
							const defenderFull = state.defender.concat(defenderNotParticipating);

							const attackerTransitions3D = [[[1]]];
							const defenderTransitions3D  =  getSpaceCannonTransition(defenderFull,attackerFull, 'defender', battleType, state.resources.defender,state.flags.defender, options.defender);

							
							

					

							var flagsToAdd = {attacker:undefined, defender:undefined};
							flagsToAdd.defender = {
								name: 'spaceCannonDefense',
								shortType: 'SPD',
								duration: -1,
							};

							
							
							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, accumulations,  game.ThrowType.SpaceCannon, battleType, options, elapsedMili);

							

							return outcome;
						}



						
						

						state.terminal = (fleetLength(state.attacker) === 0 || fleetLength(state.defender) === 0);
						if (state.terminal){
							state.attacker = state.attacker.filter(obj => !obj.leaveEarly);
							state.defender = state.defender.filter(obj => !obj.leaveEarly);

							if (fleetLength(state.attacker)=== 0){
								state.attacker = []
							}
							if (fleetLength(state.defender)=== 0){
								state.defender = []
							}
							state.flags.attacker.push({
								name: 'beforeCombatTerminal',
								shortType: 'BCT',
								duration: -1,
							});
							state.flags.defender.push({
								name: 'beforeCombatTerminal',
								shortType: 'BCT',
								duration: -1,
							});
							outcome[3] = true;
							return outcome;
						}

						state.timing = 'duringCombat';
						break;

					case "duringCombat":
						var output = abilityPassing(state, battleType, accumulations);
						if (output){

							return output;
						}
						state.timing = 'startOfCombat';
						break;

					case "startOfCombat": 
						var output = abilityPassing(state, battleType, accumulations);
						if (output){

							return output;
						}
						state.timing = 'barrage';
						break;

					
					case "startOfRound":

						var output = abilityPassing(state, battleType, accumulations);
						if (output){

							return output;
						}
						state.timing = 'combatRolls';
						break;
					
					
					case "barrage":

						if (!state.flags.attacker.some(obj => obj.name == 'barrage') && battleType === 'Space'){

							// const attackerFull = state.attacker.concat(attackerNotParticipating);
							// const defenderFull = state.defender.concat(defenderNotParticipating);

							const attackerTransitions3D = getBarrageTransition(state.attacker, state.defender, 'attacker', battleType, state.resources.attacker,state.flags.attacker, options.attacker);
							const defenderTransitions3D  =  getBarrageTransition(state.defender,state.attacker, 'defender', battleType, state.resources.defender,state.flags.defender, options.defender);

							
							

					

							var flagsToAdd = {attacker:undefined, defender:undefined};
							flagsToAdd.attacker = {
								name: 'barrage',
								shortType: 'AFB',
								duration: -1,
							};
							flagsToAdd.defender = {
								name: 'barrage',
								shortType: 'AFB',
								duration: -1,
							};

							
							
							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, accumulations, game.ThrowType.Barrage, battleType,  options, elapsedMili);

							

							

							return outcome;
						}

						state.timing ="combatRolls";
						break;
					
					case "combatRolls":

						// print(state.resources.attacker);
						// print(state.attacker);

						if (!state.flags.attacker.some(obj => obj.name == 'combatRolls')){




							

							const attackerTransitions3D = computeFleetTransitionsWrapper(
								state.attacker,
								state.defender,
								'attacker',
								battleType,
								state.resources.attacker,
								game.ThrowType.Battle,
								state.flags.attacker,
								options.attacker,
							)


							

							

							const defenderTransitions3D = computeFleetTransitionsWrapper(
								state.defender,
								state.attacker,
								'defender',
								battleType,
								state.resources.defender,
								game.ThrowType.Battle,
								state.flags.defender,
								options.defender,
							)

							

							
							


							var flagsToAdd = {attacker:undefined, defender:undefined};
							flagsToAdd.attacker={
								name: 'combatRolls',
								shortType: 'CR',
								duration: 1,
							};
							flagsToAdd.defender={
								name: 'combatRolls',
								shortType: 'CR',
								duration: 1,
							};

							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, accumulations, game.ThrowType.Battle, battleType,  options, elapsedMili);

							

							
							return outcome;

						}
						state.timing = 'endOfRound';
						break;
						

					case "endOfRound":

						if (!state.flags.attacker.some(obj => obj.name == 'harrow') && battleType === game.BattleType.Ground && options.attacker.abilities.harrow){

							const filter = function(unit){
								return !unit.notInSystem && (unit.typeShip || (unit.abilities.includes('l1z1xMech') && unit.notParticipating && battleType === game.BattleType.Ground));
							}

							const attackerFull = state.attacker.concat(attackerNotParticipating).filter(filter);
							const defenderFull = state.defender.concat(defenderNotParticipating);

							const attackerTransitions3D  = getBombardmentTransition(attackerFull, defenderFull, 'attacker', battleType, state.resources.attacker,state.flags.attacker, options.attacker);
							const defenderTransitions3D  =  [[[1]]];

							

							
							

					

							var flagsToAdd = {attacker:undefined, defender:undefined};
							flagsToAdd.attacker = {
								name: 'harrow',
								shortType: 'HAR',
								duration: 1,
							};

							
							
							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D,  flagsToAdd, accumulations, game.ThrowType.Bombardment, battleType,  options, elapsedMili);

							

							return outcome;
						}

						state.timing = 'cleanup';						
						break;
					case "cleanup":
					
						accumulations.rounds++;

						markDamagedNotThisRound(state.attacker);
						markDamagedNotThisRound(state.defender);

						for (var flag of state.flags.attacker) {
							if (flag.duration > 0){
								flag.duration--;
							}
						}
						state.flags.attacker = state.flags.attacker.filter(flag => flag.duration !== 0);

						for (var flag of state.flags.defender) {
							if (flag.duration > 0){
								flag.duration--;
							}
						}
						state.flags.defender = state.flags.defender.filter(flag => flag.duration !== 0);

						

						state.terminal = (fleetLength(state.attacker) === 0 || fleetLength(state.defender) === 0);
						if (state.terminal){
							state.attacker = state.attacker.filter(obj => !obj.leaveEarly);
							state.defender = state.defender.filter(obj => !obj.leaveEarly);

							if (fleetLength(state.attacker)=== 0){
								state.attacker = []
							}
							if (fleetLength(state.defender)=== 0){
								state.defender = []
							}
							outcome[3] = true;
							return outcome;
						}


						state.timing = 'startOfRound';

						
						break;
					
					default: console.warn("Unknown timing:", state);
				}

				return outcome;
			}

			

			
			function reduceState(startState) {
				// quick check (same as original)
				if (explorationMap.has(startState.startKey)) {
					return explorationMap.get(startState.startKey);
				}

				// Frame structure:
				// { state, stage, meta }
				// stage: 'enter' (first time), 'finish' (after children processed)
				const stack = [];

				startState.startKey+='//start';
				const newKey = startState.startKey;
				
				
				
				stack.push({ state: startState, stage: 'enter', meta: null });


				
				
				const transitions=[1]; 
				const newStates = [startState];
				const rewards = [{attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0}];
				stack.push({
							state: startState,
							stage: 'finish',
							meta: { newKey, transitions, newStates, rewards }
						});

				const simplifiedState = {
					attacker: startState.attacker?.map(a => ({ shortType: a.shortType })) || [],
					defender: startState.defender?.map(d => ({ shortType: d.shortType })) || [],
					timing: startState.timing,
					resources: startState.resources,
					rewards: [],
					
					nextStates: [],
					terminal: startState.terminal,
					prob: startState.prob,
					transitionArray: [],
				};

				states.set(newKey, simplifiedState)

				const startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    			

				while (stack.length) {
					// const frame = stack.pop();
					const frame = stack.shift();
					var state = frame.state;

					var elapsedMili = (((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime)

					

					// If mapping already exists (could have been created while other frames processed), skip
					if (explorationMap.has(state.startKey) && frame.stage === 'enter') {
						// nothing to do for this enter frame
						continue;
					}

					if (frame.stage === 'enter') {
						// replicate the original logic that ran runState on the incoming state and produced:
						// transitions, newStates, rewards and a mutated "state" representing the resulting state
						let accumulation = frame.accumulations || { attacker: { tgsEarned: 0, tgsSpent: 0 }, defender: { tgsEarned: 0, tgsSpent: 0 }, rounds: 0 };

						let transitions = [];
						let newStates = [];
						
						let rewards = [];
						let done = false;

						

						let limit = 100;



						for (let i = 0; i < limit; i++) {
								
							[transitions, newStates, rewards, done] = runState(state, accumulation, elapsedMili);
							// print([transitions, newStates, rewards, done]);
							// print(state.timing);
							// print(state);
							// print(i);
							// print(transitions);
							if (transitions[0] < 0.99999) {
								done = true;
							}
							if (done) break;

							if (i >= limit-1){
								print('state loop limit reached ERROR ERROR');
								break;
							}
						}
						

						

						
						

						// compute final key for this processed state (this matches original)
						const newKey = buildStateKey(state.attacker, state.defender, state.resources, state.flags);

						

						// Insert mapping into explorationMap now (prevents cycles from recursing).
						if (!explorationMap.has(state.startKey)) {
							explorationMap.set(state.startKey, [newKey, accumulation]);
						}

						
						if (states.has(newKey)) {
							continue;
						}

						// Create a placeholder simplifiedState in states now so other frames see it's "being processed"
						const simplifiedState = {
							attacker: state.attacker?.map(a => ({ shortType: a.shortType })) || [],
							defender: state.defender?.map(d => ({ shortType: d.shortType })) || [],
							timing: state.timing,
							resources: state.resources,
							rewards: [],
							// accumulation: accumulation,
							nextStates: [],
							terminal: state.terminal,
							prob: 0,
							transitionArray: [],
						};



						states.set(newKey, simplifiedState);

						// We'll finish populating simplifiedState after children are processed.
						// Push a 'finish' frame that contains the newKey and arrays needed to finalize.
						

						// Push child frames for each child newState that is not already in explorationMap.
						// We push children in LIFO order so that the first child gets processed before others (not required but consistent).
						for (let i = newStates.length - 1; i >= 0; i--) {
							const child = newStates[i];
							if (!explorationMap.has(child.startKey)) {
								// child not discovered -> explore it
								stack.push({ state: child, stage: 'enter'});
							}
							// if already discovered, we don't need to push; its mapping will be used in 'finish'
						}

						stack.push({
							state: state, // mutated final-state object (we need newStates, transitions, rewards)
							stage: 'finish',
							
							meta: { newKey, transitions, newStates, rewards }
						});

					} else if (frame.stage === 'finish') {
						// finalize the simplifiedState using data from meta
						const { newKey, transitions, newStates, rewards } = frame.meta;
						const simplifiedState = states.get(newKey);
						if (!simplifiedState) {
							// defensive: if someone removed it, recreate
							states.set(newKey, {
								attacker: frame.state.attacker?.map(a => ({ shortType: a.shortType })) || [],
								defender: frame.state.defender?.map(d => ({ shortType: d.shortType })) || [],
								resources: frame.state.resources,
								rewards: [],
								nextStates: [],
								terminal: frame.state.terminal,
								prob: frame.state.prob,
								transitionArray: [],
							});
						}

						
						// fill rewards and transitionArray and nextStates (look up child mapping in explorationMap)
						for (let i = 0; i < newStates.length; i++) {
							const child = newStates[i];
							const transition = transitions[i];
							const reward = rewards[i];

							// simplifiedState.rewards.push(reward);
							simplifiedState.transitionArray.push(transition);

							// The child's mapping must exist now (either it pre-existed or we processed it in the stack)
							const [childKey, nextAccumulation] = explorationMap.get(child.startKey);
							if (typeof childKey === 'undefined') {
								// This should not happen; fallback to a placeholder (defensive)
								// console.warn('Child key not found for startKey:', child.startKey);
								simplifiedState.nextStates.push(null);
								simplifiedState.rewards.push(null);
							} else {
								simplifiedState.nextStates.push(childKey);
								simplifiedState.rewards.push(combineAccumulations(reward,nextAccumulation, 1));
							}
						}
					}
				} // end while stack

				// return mapping now (as original reduceState did)
				return explorationMap.get(startState.startKey);
			}

			function combineAccumulations(obj1, obj2, modifier) {
				var scale = modifier;
				obj1.attacker.tgsEarned += obj2.attacker.tgsEarned * scale;
				obj1.attacker.tgsSpent += obj2.attacker.tgsSpent* scale;
				obj1.defender.tgsEarned += obj2.defender.tgsEarned * scale;
				obj1.defender.tgsSpent += obj2.defender.tgsSpent* scale;
				
				obj1.rounds += (obj2.rounds * scale);
				
				return obj1;
			}



			var resources = {attacker:{}, defender:{}};
			var flags = {attacker:[], defender:[]};
			var attackerNum;
			var defenderNum;
			for (var [resourceName, resource] of Object.entries(game.resources)){
				[attackerNum,defenderNum] = resource.calc(options);
				if (attackerNum > 0)
					resources.attacker[resourceName] = {total: attackerNum, shortType: resource.shortType};
				if (defenderNum > 0)
					resources.defender[resourceName] = {total: defenderNum, shortType: resource.shortType};
			}

			



			var startState = {
				attacker: cloneFleet(attacker),
				defender: cloneFleet(defender),
				resources: resources,
				flags: flags,
				startKey: buildStateKey(attacker, defender, resources, flags),
				timing: 'beforeCombat',
				prob: 1,
				turn: 'attacker',
				
				transitionArray: null, // will be filled when processed
				nextStates: null,       // will be filled when processed
				terminal: false,
				
			}
			// print(startState.attacker);
			// print(startState.defender);
			// print(startState.startKey);
			// print( stableUnitSignature(startState.defender[0]));
			// print(sideToLabelString(startState.defender))

			_ = reduceState(startState);

			console.log(states);
			// console.log(states2);
			console.log(explorationMap);

			var terminals = Array.from(states.entries())
				.filter(([_, value]) => value.terminal === true)
				.map(([key]) => key);

			var nonTerminals = Array.from(states.entries())
				.filter(([_, value]) => value.terminal !== true)
				.map(([key]) => key);

			// print(Array.from(states.entries())
			// 	.filter(([_, value]) => value.terminal !== true)
			// 	.map(([key, value]) => [key, value]));
			
			// print(Array.from(states.entries())
			// 	.filter(([_, value]) => value.terminal === true)
			// 	.map(([key, value]) => [key, value]));

			var finalAccumulations = {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0};
			for (var it = 0; it < 1200 && (terminals.reduce((sum, key) => sum + (states.get(key)?.prob || 0), 0) < 0.9999); it++) {
				for (var i = 0; i < nonTerminals.length; ++i){
					const key = nonTerminals[i];
					const state = states.get(key);
					const nextStates = state.nextStates;
					var prob = state.prob;
					state.prob = 0;

					// input.storedValues.rounds +=prob;
					for (var j = 0; j < nextStates.length; ++j){
						const nextKey = nextStates[j];
						const nextState = states.get(nextKey);
						nextState.prob += prob * state.transitionArray[j];
						
						// finalAccumulations.rounds += prob * state.transitionArray[j] * state.rewards[j].rounds;
						
						combineAccumulations(finalAccumulations, state.rewards[j], prob * state.transitionArray[j]);
						

						
					}
				}

				// print(Array.from(states.entries())
				// .filter(([_, value]) => true)
				// .map(([key, value]) => [key, value]));
				// print(finalAccumulations);

			}
			print('done calc!');

			

			var finalAttacker = attacker.map(function (unit) {
				return [unit.shortType];
			});
			var finalDefender =defender.map(function (unit) {
				return [unit.shortType];
			});

			



			var result = new structs.EmpiricalDistribution();
			for (var i = 0; i < terminals.length; ++i){
				const key = terminals[i];
				const state = states.get(key);
				
				if (state.attacker.length != 0) {
					result.increment(-state.attacker.length, state.prob);
					for (var a = 0; a < state.attacker.length; a++) {
						if (!finalAttacker[a])
							finalAttacker[a] = [];
						if (finalAttacker[a].indexOf(state.attacker[a].shortType) < 0)
							finalAttacker[a].push(state.attacker[a].shortType);
					}
				} else if (state.defender.length !== 0) {
					result.increment(state.defender.length, state.prob);
					for (var d = 0; d < state.defender.length; d++) {
						if (!finalDefender[d])
							finalDefender[d] = [];
						if (finalDefender[d].indexOf(state.defender[d].shortType) < 0)
							finalDefender[d].push(state.defender[d].shortType);
					}
				} else
					result.increment(0, state.prob);
			}

			

			return [result, finalAttacker, finalDefender, finalAccumulations];
		}

		function computeUnitTransitions2(unit, throwType, modifier, modifierRoll, reroll, thisSideOptions, ambush){
			const [result,plasmaViable, _, __, ___] = computeUnitTransitions3(unit, throwType, modifier, modifierRoll, reroll, thisSideOptions, ambush);
			return [result,plasmaViable];
		}

		function bestUnitCalcStats(unit, throwType, modifier, modifierRoll, reroll, thisSideOptions){
			const [_,__, singleDie, rerolled, max] = computeUnitTransitions3(unit, throwType, modifier, modifierRoll, reroll, thisSideOptions);

			
			const newModifier = 
				function (unitIn) {
					return modifier(unitIn) + 1;
				};
				

			const [___,____,newSingleDie,_____,______] = computeUnitTransitions3(unit, throwType, newModifier, modifierRoll, reroll, thisSideOptions);

			return [singleDie, newSingleDie.map((num, index) => num - singleDie[index]), rerolled, max];
		}

		function computeUnitTransitions3(unit, throwType, modifier, modifierRoll, reroll, thisSideOptions, ambush) {
			var battleValue = unit[game.ThrowValues[throwType]];
			var diceCount = unit[game.ThrowDice[throwType]] + (unit.galvanized ? 1 : 0);
			var modifierFunction = function (unit) {
				return unit.isDamageGhost || ambush ? 0 : typeof modifier === 'function' ? modifier(unit) : modifier;
			};
			var modifierRollFunction = function (unit) {
				return unit.isDamageGhost || ambush ? 0 : typeof modifierRoll === 'function' ? modifierRoll(unit) : modifierRoll;
			};
			var rerollFunction = function (unit) {
				return unit.isDamageGhost || ambush ? false : typeof reroll === 'function' ? reroll(unit) : reroll;
			};
			var singleDie = [];
			var diceRolls= ambush ? 1 : diceCount + modifierRollFunction(unit);
			var oneRollMiss = Math.max(Math.min((battleValue - 1 - modifierFunction(unit)) / game.dieSides, 1), 0);

			var max = battleValue - 1 - modifierFunction(unit);

			if (diceRolls===0) return [[1], false];
			
			singleDie.push(oneRollMiss)
			singleDie.push( 1 - singleDie[0]);



			if (rerollFunction(unit)){
				
				var transition = singleDie.map((num, index) => {
					if (index === 0) {
						return num * singleDie[0];
					} else {
						return num * (singleDie[0]+1);
					}
				});
				
			}else {
				var transition = singleDie;
			}

			const plasmaViable = battleValue - modifierFunction(unit) <= 7;

			// for the crown of thalnos, add a 0.1 at the end, and subtract 0.1 from the old end
			// for plasma scoring, output wether this unit would benefit, then split the units into benefit vs no benefit, the benefits all slideMultiply, then shift over by one, and add the last to the end i.e. [0.25,0.5,0.25] to [0,0.25,0.5+0.25]
			
			var result = transition;
			for (var i = 1; i < diceRolls; i++) {
				result = slideMultiply(result, singleDie);
			}
			
			while(result[result.length-1] === 0){ // While the last element is a 0,
				result.pop();                  // Remove that last element
			}
			return [result,plasmaViable, singleDie, rerollFunction(unit), max];
		}

		



		
		



		





		



			



		






		

		





		











		
























		function getBoostFunctions(fleet, opponentFleet, battleSide, battleType, thisSideResources, throwType, thisSideFlags, thisSideOptions){

			const basicUnitFunction = function (unitIn) {
								return 0;
							};
			var boosts = basicUnitFunction;
			var rollBoosts = basicUnitFunction;

			var rerolls = function (unitIn) {
					return false;
				};

			var rollBoostChoseUnit=[];
			var boostChoseUnit=[];
			
			var rerollDone = false;
			
			for (const flag of thisSideFlags){
				
				const rollBoost = activeRollBoosts[flag.name];
				
				if (rollBoost){
					const output = rollBoost.apply(flag.unitPointer, battleType, throwType, thisSideOptions);
					if (rollBoost.singleUnit){
						rollBoostChoseUnit.push(compose(basicUnitFunction,output));
					} else {
						
						rollBoosts=compose(rollBoosts, output);
					}
					
				}

				const boost = activeBoosts[flag.name];
				
				if (boost){
					const output = boost.apply(flag.unitPointer, battleType, throwType, thisSideOptions);
					if (boost.singleUnit){
						boostChoseUnit.push(compose(basicUnitFunction,output));
					} else {
						boosts=compose(boosts, output);
					}
					
				}

				if (!rerollDone){
					const reroll = activeRerolls[flag.name];
					if (reroll){
						const output = reroll.apply(flag.unitPointer, battleType, throwType, thisSideOptions);
						rerolls=composeRerolls(rerolls, output);

						if (output === true){rerollDone = true;} 
					}
				}
				

			}
			for (const passive of passiveRollBoosts){
				if (passive.condition(fleet, opponentFleet, battleSide, battleType,thisSideResources,thisSideFlags, thisSideOptions)){
					
					const output = passive.apply(undefined, battleType, throwType, thisSideOptions);
					if (passive.singleUnit){
						rollBoostChoseUnit.push(compose(basicUnitFunction,output))
					} else {
						rollBoosts=compose(rollBoosts, output);
					}
				}
			}

			for (const passive of passiveBoosts){
				if (passive.condition(fleet, opponentFleet, battleSide, battleType,thisSideResources,thisSideFlags, thisSideOptions)){
					const output = passive.apply(undefined, battleType, throwType, thisSideOptions);
					if (passive.singleUnit){
						boostChoseUnit.push(compose(basicUnitFunction,output))
					} else {
						boosts=compose(boosts, output);
					}
				}
			}
			if (!rerollDone){
				for (const passive of passiveRerolls){
					if (passive.condition(fleet, opponentFleet, battleSide, battleType,thisSideResources,thisSideFlags, thisSideOptions)){
						const output = passive.apply(undefined, battleType, throwType, thisSideOptions);
						rerolls=composeRerolls(rerolls, output);

						if (output === true){
							rerollDone = true;
							break;
						} 
					}
				}
			}



			

			

			// if (battleSide === 'attacker'){

			// 	fleet[0].battleValue = 3;
			// 	fleet[1].battleValue = 4;
			// 	fleet[1].battleDice = 3;
			// 	fleet[2].battleValue = 10;
			// 	fleet[2].battleDice = 4;

			// 	// rollBoostChoseUnit.push(compose(basicUnitFunction,3))
			// 	boostChoseUnit.push(compose(basicUnitFunction,2))

				

			// }

			

			function getUnitFunction(unit){
				const [V, D, reroll, max]=bestUnitCalcStats(unit, throwType, boosts, rollBoosts, rerolls, thisSideOptions);

				// print(V);
				// print(reroll);
				
				const eV = V.reduce((sum, p, i) => sum + i * p, 0);
				const eD = D.reduce((sum, p, i) => sum + i * p, 0);
				const ki = unit[game.ThrowDice[throwType]];
				const d0=D[0];
				const v0=V[0];
				const output = reroll ? function(n,k){
					n = Math.min(max,n);
					return (1+v0+n*d0) * (eV+eD*n)*(ki+k) - (1+v0)*eV*ki
				} : function(n,k){
					n = Math.min(max,n);
					return (eV+eD*n)*(ki+k) - eV*ki
				}

				return output
			}

			// if we have both roll modifier and number of rolls modifier, then do a brute-force search for the best distribution
			if (rollBoostChoseUnit.length > 0 && boostChoseUnit.length > 0) {
				
				var unitFunctions = [];
				for (const unit of fleet){

					unitFunctions.push(getUnitFunction(unit));
				}

				
				var bestValue = 0;
				var bestIndex = 0;

				const total = Math.pow(fleet.length, rollBoostChoseUnit.length + boostChoseUnit.length);

				for (let k = 0; k < total; k++) {

					var map = new Map();
					for (let i = 0; i < rollBoostChoseUnit.length; i++) {
						const unitIndex = Math.floor(k / Math.pow(fleet.length, i)) % fleet.length;
						const unit = fleet[unitIndex];
						const rollBoostNum = rollBoostChoseUnit[i](unit);
						
						var saved = map.get(unitIndex);
						if (map.get(unitIndex) === undefined){
							map.set(unitIndex,[0,rollBoostNum]);
						} else {
							saved[1] = saved[1] + rollBoostNum;
							map.set(unitIndex,saved);
						}

					}
					for (let i = 0; i < boostChoseUnit.length; i++) {
						const unitIndex = Math.floor(k / Math.pow(fleet.length, i + rollBoostChoseUnit.length)) % fleet.length;
						const unit = fleet[unitIndex];

						const boostNum = boostChoseUnit[i](unit);
						
						var saved = map.get(unitIndex);
						if (map.get(unitIndex) === undefined){
							map.set(unitIndex,[boostNum,0]);
						} else {
							saved[0] = saved[0] + boostNum;
							map.set(unitIndex,saved);
						}

					}
					var tot = 0;
					for (const [key, value] of map.entries()) {
						tot += unitFunctions[key](value[0],value[1]);
					}
					if (tot > bestValue){
						bestValue = tot;
						bestIndex = k;
					}
				}

				
			
				for (let i = 0; i < rollBoostChoseUnit.length; i++) {
					const unitIndex = Math.floor(bestIndex / Math.pow(fleet.length, i)) % fleet.length;
					const unit = fleet[unitIndex];

					const output = function (unitIn) {
								return (unitIn !== unit) ? rollBoostChoseUnit[i](unit) : 0;
							};
					rollBoosts=compose(rollBoosts, output);
				}
				for (let i = 0; i < boostChoseUnit.length; i++) {
					const unitIndex = Math.floor(bestIndex / Math.pow(fleet.length, i + rollBoostChoseUnit.length)) % fleet.length;
					const unit = fleet[unitIndex];

					const output = function (unitIn) {
							return (unitIn !== unit) ? boostChoseUnit[i](unit) : 0;
						};
					boosts=compose(boosts, output);

				}
			} else if (rollBoostChoseUnit.length > 0){
				
				for (let i = 0; i < rollBoostChoseUnit.length; i++) {
					const rollBoost = rollBoostChoseUnit[i];

					var bestValue = 0;
					var bestUnit = fleet[0];

					for (const unit of fleet){
						if (unit.isDamageGhost) continue;
						
						const value = getUnitFunction(unit)(0,rollBoost(unit));

						if (value > bestValue){
							bestValue = value;
							bestUnit = unit;
						}
					}
					

					const output = function (unitIn) {
								return (unitIn === bestUnit) ? rollBoost(bestUnit) : 0;
							};

					rollBoosts=compose(rollBoosts, output);

				}
			} else if (boostChoseUnit.length > 0){
				for (let i = 0; i < boostChoseUnit.length; i++) {
					const boost = boostChoseUnit[i];

					var bestValue = 0;
					var bestUnit = fleet[0];

					

					for (const unit of fleet){
						if (unit.isDamageGhost) continue;
						const value = getUnitFunction(unit)(boost(unit), 0);

						if (value > bestValue){
							bestValue = value;
							bestUnit = unit;
						}
					}

					

					const output = function (unitIn) {
								return (unitIn === bestUnit) ? boost(bestUnit) : 0;
							};

					boosts=compose(boosts, output);

				}
			}
				
			

			return [boosts, rollBoosts, rerolls]

			function compose(boost1, boost2){
				var boost2IsFunction = typeof boost2 === 'function';
				const output = 
					function (unitIn) {
						return boost1(unitIn) + (boost2IsFunction ? boost2(unitIn) : boost2);
					};
				return output;
			}

			function composeRerolls(boost1, boost2){
				var boost2IsFunction = typeof boost2 === 'function';
				const output = 
					function (unitIn) {
						return boost1(unitIn) || (boost2IsFunction ? boost2(unitIn) : boost2);
					};
				return output;
			}

		
		} 





		function getBoostAndSpecialFunctions(fleet, opponentFleet, battleSide, battleType, thisSideResources, throwType, thisSideFlags,  thisSideOptions, raw = false){

			var specials = function (unitIn) {
					return false;
				};
			
			if (!raw){
				for (const flag of thisSideFlags){
					if (flag.name === 'l1z1xFlagship'){
						const output = function(unitIn) {
							return (unitIn.type === game.UnitType.Dreadnought  || unitIn === flag.unitPointer)
						}
						specials = compose(specials, output);
					}
				}
			}


			

			

			

			const basicUnitFunction = function (unitIn) {
								return 0;
							};
			var boosts = basicUnitFunction;
			var rollBoosts = basicUnitFunction;
			var rerolls = basicUnitFunction;

			var rollBoostChoseUnit=[];
			var boostChoseUnit=[];

			if (!raw) {
			
			for (const flag of thisSideFlags){
				
				const rollBoost = activeRollBoosts[flag.name];
				
				if (rollBoost){
					const output = rollBoost.apply(flag.unitPointer, battleType, throwType, thisSideOptions);
					if (rollBoost.singleUnit){
						rollBoostChoseUnit.push(compose(basicUnitFunction,output));
					} else {
						
						rollBoosts=compose(rollBoosts, output);
					}
					
				}

				const boost = activeBoosts[flag.name];
				
				if (boost){
					const output = boost.apply(flag.unitPointer, battleType, throwType, thisSideOptions);
					if (boost.singleUnit){
						boostChoseUnit.push(compose(basicUnitFunction,output));
					} else {
						boosts=compose(boosts, output);
					}
					
				}

				
				const reroll = activeRerolls[flag.name];

				if (reroll){
					const output = reroll.apply(flag.unitPointer, battleType, throwType, thisSideOptions);
					rerolls=compose(rerolls, output);

					
				}
				
				

			}

			for (const passive of passiveRollBoosts){
				// print(passive);
				// print(thisSideOptions);
				// print(passive.condition(fleet, opponentFleet, battleSide, battleType,thisSideResources,thisSideFlags, thisSideOptions));
				if (passive.condition(fleet, opponentFleet, battleSide, battleType,thisSideResources,thisSideFlags, thisSideOptions)){
					
					
					const output = passive.apply(battleType, throwType, thisSideOptions);
					if (passive.singleUnit){
						rollBoostChoseUnit.push(compose(basicUnitFunction,output))
					} else {
						rollBoosts=compose(rollBoosts, output);
					}
				}
			}

			for (const passive of passiveBoosts){
				if (passive.condition(fleet, opponentFleet, battleSide, battleType,thisSideResources,thisSideFlags, thisSideOptions)){
					const output = passive.apply(battleType, throwType, thisSideOptions);
					if (passive.singleUnit){
						boostChoseUnit.push(compose(basicUnitFunction,output))
					} else {
						boosts=compose(boosts, output);
					}
				}
			}
			
			for (const passive of passiveRerolls){
				if (passive.condition(fleet, opponentFleet, battleSide, battleType,thisSideResources,thisSideFlags, thisSideOptions)){
					const output = passive.apply(battleType, throwType, thisSideOptions);
					rerolls=compose(rerolls, output);

					
				}
			}
			
			}

			if (thisSideResources.meld && thisSideResources.meld.total > 0){
				// thisSideResources.meld.total -= 1;
				rollBoostChoseUnit.push('meld');
			}

			var meldTargets =  function (unitIn) {
								return false;
							};
			

			

			
			function getExpected(unit, boost, rollBoost, meld){


				
				const fakeFleet = [unitToFakeUnit(unit, throwType, composeBool(meldTargets,meld), compose(boosts,boost), compose(rollBoosts,rollBoost), rerolls, false, thisSideOptions)];
				const prob3D = exact(fakeFleet, crown, false, 0);
				const expectedTotalHits = prob3D.reduce(
						(sum, row, hn) =>
							sum + row.reduce(
							(inner, col, hs) =>
								inner + col.reduce((inner2, p, s) => inner2 + p * (hn + hs), 0),
							0
							),
						0
				);
				return expectedTotalHits;


			}

			
			if (rollBoostChoseUnit.length > 0 || boostChoseUnit.length > 0){
				var unitExpectations = [];
				for (const unit of fleet){
					unitExpectations.push(getExpected(unit, 0, 0, false));
				}
			}
			

			// if we have both roll modifier and number of rolls modifier, then do a brute-force search for the best distribution
			if (rollBoostChoseUnit.length > 0 && boostChoseUnit.length > 0) {

				var crown = thisSideOptions.crownOfThalnos && throwType === game.ThrowType.Battle;
				
				
				
				var bestValue = 0;
				var bestValueSpecial=0;
				var bestIndex = 0;

				const total = Math.pow(fleet.length, rollBoostChoseUnit.length + boostChoseUnit.length);

				for (let k = 0; k < total; k++) {

					var map = new Map();
					for (let i = 0; i < rollBoostChoseUnit.length; i++) {
						const unitIndex = Math.floor(k / Math.pow(fleet.length, i)) % fleet.length;
						const unit = fleet[unitIndex];
						
						const rollBoostNum = rollBoostChoseUnit[i];
						var saved = map.get(unitIndex);
						if (rollBoostNum === 'meld'){
							if (saved === undefined) {
								map.set(unitIndex, [0,0,true])
							} else {
								saved[2] = true;
								map.set(unitIndex, saved);
							}
						} else {
							if (saved === undefined) {
								map.set(unitIndex, [0,rollBoostNum(unit),false])
							} else {
								saved[1] += rollBoostNum(unit);
								map.set(unitIndex, saved);
							}
						}
						
						

					}
					for (let i = 0; i < boostChoseUnit.length; i++) {
						const unitIndex = Math.floor(k / Math.pow(fleet.length, i + rollBoostChoseUnit.length)) % fleet.length;
						const unit = fleet[unitIndex];

						const boostNum = boostChoseUnit[i](unit);
						
						var saved = map.get(unitIndex);
						if (map.get(unitIndex) === undefined){
							map.set(unitIndex,[boostNum,0,false]);
						} else {
							saved[0] = saved[0] + boostNum;
							map.set(unitIndex,saved);
						}

					}
					
					var tot = 0;
					var totSpecial= 0;
					for (const [key, value] of map.entries()) {
						const val = getExpected(fleet[key], ...value)-unitExpectations[key];
						tot += val;
						if (specials(fleet[key])){
							totSpecial += val;
						}
					}
					if (tot > bestValue || (tot > (bestValue-1e-6) && totSpecial > bestValueSpecial)){
						bestValue = tot;
						bestIndex = k;
						bestValueSpecial = totSpecial;
					}
				}

				
			
				for (let i = 0; i < rollBoostChoseUnit.length; i++) {
					const unitIndex = Math.floor(bestIndex / Math.pow(fleet.length, i)) % fleet.length;
					const unit = fleet[unitIndex];

					const rb = rollBoostChoseUnit[i];

					if (rb === 'meld'){
						const output = function (unitIn) {
								return (unitIn === unit);
							};
						meldTargets = composeBool(meldTargets, output);
						
					} else {
						const output = function (unitIn) {
								return (unitIn === unit) ? rb(unit) : 0;
							};
						rollBoosts=compose(rollBoosts, output);
					}

					
				}
				for (let i = 0; i < boostChoseUnit.length; i++) {
					const unitIndex = Math.floor(bestIndex / Math.pow(fleet.length, i + rollBoostChoseUnit.length)) % fleet.length;
					const unit = fleet[unitIndex];

					const output = function (unitIn) {
							return (unitIn === unit) ? boostChoseUnit[i](unit) : 0;
						};
					boosts=compose(boosts, output);

				}
			} else if (rollBoostChoseUnit.length > 0){
				
				for (let i = 0; i < rollBoostChoseUnit.length; i++) {
					const rollBoost = rollBoostChoseUnit[i];

					var bestValue = 0;
					var bestUnit = fleet[0];

					for (let j = 0; j < fleet.length; j++){
						const unit = fleet[j];
						if (unit.isDamageGhost) continue;

						

						var value = (rollBoost === 'meld' ? getExpected(unit, 0,0, true) : getExpected(unit, 0,rollBoost, false)) - unitExpectations[j];
						
						

						if (value > bestValue || (value > (bestValue-1e-6 && specials(unit) && !specials(bestUnit)))){
							bestValue = value;
							bestUnit = unit;
						}
					}
					
					if (rollBoost === 'meld'){
						const output = function (unitIn) {
								return (unitIn === bestUnit);
							};
						
						meldTargets = composeBool(meldTargets, output);
						
					} else {
						const output = function (unitIn) {
									return (unitIn === bestUnit) ? rollBoost(bestUnit) : 0;
								};

						rollBoosts=compose(rollBoosts, output);
					}

				}
			} else if (boostChoseUnit.length > 0){
				for (let i = 0; i < boostChoseUnit.length; i++) {
					const boost = boostChoseUnit[i];

					var bestValue = 0;
					var bestUnit = fleet[0];

					

					for (let j = 0; j < fleet.length; j++){
						const unit = fleet[j];
						if (unit.isDamageGhost) continue;
						
						var value = getExpected(unit, boost, 0, false) - unitExpectations[j];
						

						if (value > bestValue || (value > (bestValue-1e-6 && specials(unit) && !specials(bestUnit)))){
							bestValue = value;
							bestUnit = unit;
						}
					}

					

					const output = function (unitIn) {
								return (unitIn === bestUnit) ? boost(bestUnit) : 0;
							};

					boosts=compose(boosts, output);

				}
			}
				
			

			return [boosts, rollBoosts, rerolls, meldTargets, specials]

			function compose(boost1, boost2){
				var boost2IsFunction = typeof boost2 === 'function';
				const output = 
					function (unitIn) {
						return boost1(unitIn) + (boost2IsFunction ? boost2(unitIn) : boost2);
					};
				return output;
			}

			function composeBool(boost1, boost2){
				var boost2IsFunction = typeof boost2 === 'function';
				const output = 
					function (unitIn) {
						return boost1(unitIn) || (boost2IsFunction ? boost2(unitIn) : boost2);
					};
				return output;
			}

		
		} 

		

		// function getSpecialUnitFunction(fleet, opponentFleet, battleSide, battleType, thisSideResources, throwType, thisSideFlags, thisSideOptions, raw = false){

		// 	var specials = function (unitIn) {
		// 			return false;
		// 		};
			
		// 	if (raw) return specials;

		// 	for (const flag of thisSideFlags){
		// 		if (flag.name === 'l1z1xFlagship'){
		// 			const output = function(unitIn) {
		// 				return (unitIn.type === game.UnitType.Dreadnought  || unitIn === flag.unitPointer)
		// 			}
		// 			specials = compose(specials, output);
		// 		}
		// 	}

		// 	return specials

		// 	function compose(boost1, boost2){
		// 		var boost2IsFunction = typeof boost2 === 'function';
		// 		const output = 
		// 			function (unitIn) {
		// 				return boost1(unitIn) || (boost2IsFunction ? boost2(unitIn) : boost2);
		// 			};
		// 		return output;
		// 	}

		// }







		function unitToFakeUnit(unit, throwType, meld, boost, boostRoll, reroll, specialUnit, thisSideOptions, raw=false){
			var boostFunction = function (unit) {
				return unit.isDamageGhost || boost === undefined ? 0 : typeof boost === 'function' ? boost(unit) : boost;
			};
			var boostRollFunction = function (unit) {
				return unit.isDamageGhost || boostRoll === undefined ? 0 : typeof boostRoll === 'function' ? boostRoll(unit) : boostRoll;
			};
			var rerollFunction = function (unit) {
				return unit.isDamageGhost || reroll === undefined ? 0 : typeof reroll === 'function' ? reroll(unit) : reroll;
			};
			var specialUnitFunction = function (unit) {
				return unit.isDamageGhost || specialUnit === undefined ? false : typeof specialUnit === 'function' ? specialUnit(unit) : specialUnit;
			};
			var meldFunction = function (unit) {
				return unit.isDamageGhost || meld === undefined ? false : typeof meld === 'function' ? meld(unit) : meld;
			};
			
			var bv = raw ? unit.battleValue : unit[game.ThrowValues[throwType]] - boostFunction(unit);
			var numDice = raw ? 1 : unit[game.ThrowDice[throwType]] + boostRollFunction(unit);
			var hitsPerDie = raw ? 1 : 1;
			var rerolls = raw ? 0 : rerollFunction(unit);
			var bonus10 = raw ? false : thisSideOptions.crownOfThalnosC;
			var jolnar = raw ? false: unit.abilities.includes('jolnarFlagship') && throwType === game.ThrowType.Battle;
			var immuneCrown = unit.type === undefined;
			var special = raw ? false : specialUnitFunction(unit);
			var useMeld = meldFunction(unit);
			
			
			
			var fakeUnit = {
					battleValue: bv, 
					dice: numDice, 
					hitsPerDie: hitsPerDie,
					rerolls: rerolls,
					bonus10: bonus10, 
					jolnar: jolnar, 
					immuneCrown: immuneCrown,
					special: special, 
					meld: useMeld,
			}
			return fakeUnit;
		}




		function computeFleetTransitionsWrapper(fleet, opponentFleet, battleSide, battleType, thisSideResources, throwType, thisSideFlags, thisSideOptions, raw=false){


			const crown = raw ? false : thisSideOptions.crownOfThalnos && throwType === game.ThrowType.Battle;
			const plasma = raw ? false : thisSideOptions.plasmaScoringC && (throwType === game.ThrowType.Barrage || throwType === game.ThrowType.Bombardment || throwType === game.ThrowType.SpaceCannon);
			var hacans = 0;
			if (thisSideResources.tgs && !raw){
				hacans = Math.min(fleet.reduce(
				(sum, obj) => sum + (obj.abilities.includes("hacanFlagship") ? 1 : 0), 0
				), thisSideResources.tgs.total);
			}




			
			// const specialUnitFunction = getSpecialUnitFunction(fleet, opponentFleet, battleSide, battleType, thisSideResources, throwType, thisSideFlags, thisSideOptions, raw);

			const [boostFunction, boostRollFunction, rerollFunction, meldFunction, specialUnitFunction] = getBoostAndSpecialFunctions(fleet, opponentFleet, battleSide, battleType, thisSideResources, throwType, thisSideFlags, thisSideOptions, raw);

			
			

			const fakeFleet=[];
			var totalDice=0;
			var meldUnit;
			for (const unit of fleet) {
				const fakeUnit = unitToFakeUnit(unit, throwType, meldFunction, boostFunction, boostRollFunction, rerollFunction, specialUnitFunction, thisSideOptions, raw);
				fakeFleet.push(fakeUnit);
				totalDice += fakeUnit.dice;
				if (fakeUnit.meld){
					meldUnit = fakeUnit;
				}



			}
			
			
			if (meldUnit &&
				plasma && 
				totalDice <= 1 && 
				!meldUnit.bonus10 && !meldUnit.jolnar && 
				((meldUnit.battleValue-hacans)<=7 || (crown && meldUnit.immuneCrown && (meldUnit.battleValue-hacans-1)<=7) )){

					meldUnit.meld=false;
			} else if (meldUnit) {
				thisSideResources.meld.total -= 1;
			}
			
			const output = exact(fakeFleet, crown, plasma, hacans);
			
			return output;

		}













function exact(units, crown, plasma, hacans) {
  const dieSides = 10;

  // ---------------------------
  // Core helpers (3-d: normalHits | specialHits | spend)
  // ---------------------------

  // Build grouped categories for a die (meld false => single-die faces, meld true => pair sums)
  function buildGroupedCategories(bv, bonus10, jolnar, hacansLocal, includeRollLessThan7 = false, meld = false, argent = false) {
    const map = new Map();
    if (!meld) {
      for (let r = 1; r <= dieSides; r++) {
        const isHit = (r >= (bv - hacansLocal));
        const spent = isHit ? Math.max(bv - r, 0) : 0;
       	let extra = 0, extraSpecial = 0;
		// existing extras (bonus10/jolnar) are neutral extras; leave them in extraNormal for now
		if (bonus10 && r === 10) extra += 1;
		if (jolnar && (r === 9 || r === 10)) extra += 2;
		if (argent && (r === 9 || r === 10)) extraSpecial += 1;
        const rollLessThanBV = r < bv;
        const rollLessThan7 = r < 7;
        const key = includeRollLessThan7
          ? `${isHit}|${spent}|${extra}|${extraSpecial}|${rollLessThanBV}|${rollLessThan7}`
          : `${isHit}|${spent}|${extra}|${extraSpecial}|${rollLessThanBV}`;

        if (!map.has(key)) map.set(key, { faces: [], isHit, spent, extra, extraSpecial, rollLessThanBV, rollLessThan7, has7: false });
        const ent = map.get(key);
        ent.faces.push(r);
        if (r === 7) ent.has7 = true;
      }
    } else {
      // meld: ordered pairs (a,b) capped to dieSides
      for (let a = 1; a <= dieSides; a++) {
        for (let b = 1; b <= dieSides; b++) {
          const capped = Math.min(a + b, dieSides);
          const isHit = (capped >= (bv - hacansLocal));
          const spent = isHit ? Math.max(bv - capped, 0) : 0;
          let extra = 0, extraSpecial = 0;
          if (bonus10 && capped === 10) extra += 1;
          if (jolnar && (capped === 9 || capped === 10)) extra += 2;
		  if (argent && (capped === 9 || capped === 10)) extraSpecial += 1;
          const rollLessThanBV = capped < bv;
          const rollLessThan7 = capped < 7;
          const key = includeRollLessThan7
            ? `${isHit}|${spent}|${extra}|${extraSpecial}|${rollLessThanBV}|${rollLessThan7}`
            : `${isHit}|${spent}|${extra}|${extraSpecial}|${rollLessThanBV}`;

          if (!map.has(key)) map.set(key, { faces: [], isHit, spent, extra, extraSpecial, rollLessThanBV, rollLessThan7, has7: false });
          const ent = map.get(key);
          ent.faces.push([a, b]);
          if (Math.min(a + b, dieSides) === 7) ent.has7 = true;
        }
      }
    }

    const denom = meld ? Math.pow(dieSides, 2) : dieSides;
    return Array.from(map.values()).map(cat => ({
      	faces: cat.faces,
		prob: cat.faces.length / denom,
		isHit: cat.isHit,
		spent: cat.spent,
		extraHits: cat.extra,        // existing
		extraSpecial: cat.extraSpecial,
		rollLessThanBV: cat.rollLessThanBV,
		rollLessThan7: cat.rollLessThan7,
		has7: !!cat.has7
    }));
  }

  // add to map with 3-d key (normalHits, specialHits, spend)
  function addToMap(map, hn, hs, s, v) {
    const k = `${hn}|${hs}|${s}`;
    map.set(k, (map.get(k) || 0) + v);
  }

  // Convolution of 3-d PMFs mapped by "hn|hs|s"
  function convolvePMFs(mapA, mapB) {
    const out = new Map();
    for (const [ka, pa] of mapA.entries()) {
      const [haN, haS, sa] = ka.split('|').map(Number);
      for (const [kb, pb] of mapB.entries()) {
        const [hbN, hbS, sb] = kb.split('|').map(Number);
        const k = `${haN + hbN}|${haS + hbS}|${sa + sb}`;
        out.set(k, (out.get(k) || 0) + pa * pb);
      }
    }
    return out;
  }

  function scalePMF(map, scalar) {
    const out = new Map();
    for (const [k, v] of map.entries()) out.set(k, v * scalar);
    return out;
  }
  function addPMFs(mapA, mapB) {
    const out = new Map(mapA);
    for (const [k, v] of mapB.entries()) out.set(k, (out.get(k) || 0) + v);
    return out;
  }
  function subtractPMFs(mapA, mapB) {
    const out = new Map(mapA);
    for (const [k, v] of mapB.entries()) out.set(k, (out.get(k) || 0) - v);
    for (const [k, v] of out.entries()) if (v < 0 && v > -1e-12) out.set(k, 0);
    return out;
  }

  // Aggregate the 3-d joint PMF into a 3D array prob3D[hn][hs][s]
  function aggregateTo3D(map) {
    let maxHN = 0, maxHS = 0, maxS = 0;
    for (const [k, p] of map.entries()) {
      const [hnStr, hsStr, sStr] = k.split('|');
      const hn = Number(hnStr), hs = Number(hsStr), s = Number(sStr);
      if (hn > maxHN) maxHN = hn;
      if (hs > maxHS) maxHS = hs;
      if (s > maxS) maxS = s;
    }
    if (maxHN < 0 || maxHS < 0 || maxS < 0) return [];

    const prob3D = Array.from({ length: maxHN + 1 }, () =>
      Array.from({ length: maxHS + 1 }, () => new Array(maxS + 1).fill(0))
    );

    for (const [k, p] of map.entries()) {
      const [hnStr, hsStr, sStr] = k.split('|');
      const hn = Number(hnStr), hs = Number(hsStr), s = Number(sStr);
      prob3D[hn][hs][s] = (prob3D[hn][hs][s] || 0) + p;
    }
    return prob3D;
  }

  // Convert per-die final choices (after rerolls) into PMF Map keyed "hn|hs|s" -> prob
  function perDieChoicesToPMF(dieEntry, choices) {
    const m = new Map();
    const isSpecialUnit = !!dieEntry.unit && !!dieEntry.unit.special;
		for (const ch of choices) {
			const cat = dieEntry.catsBV[ch.idx];
			const extra = cat.extraHits || 0;
			const extraSpecial = cat.extraSpecial || 0;
			let hn = 0, hs = 0;
			if (isSpecialUnit) {
				hs = extra + extraSpecial + (cat.isHit ? dieEntry.hitsPerDie : 0);
				hn = 0;
			} else {
				hn = extra + (cat.isHit ? dieEntry.hitsPerDie : 0);
				hs = extraSpecial;
			}
		const s = cat.isHit ? cat.spent : 0;
		addToMap(m, hn, hs, s, ch.prob);
		}
    return m;
  }

  // General variant that accounts for choices whose src may be BV or BVminus1
//   function perDieChoicesToPMF_general(dieEntry, choices) {
//     const m = new Map();
//     const isSpecialUnit = !!dieEntry.unit && !!dieEntry.unit.special;
//     for (const ch of choices) {
//       const usedCats = (ch.src === 'BV') ? dieEntry.catsBV : dieEntry.catsBVminus1;
//       const cat = usedCats[ch.idx];
//       const extra = cat.extraHits || 0;
//       let hn = 0, hs = 0;
//       if (isSpecialUnit) {
//         hs = extra + (cat.isHit ? dieEntry.hitsPerDie : 0);
//       } else {
//         hn = extra + (cat.isHit ? dieEntry.hitsPerDie : 0);
//       }
//       const s = cat.isHit ? cat.spent : 0;
//       addToMap(m, hn, hs, s, ch.prob);
//     }
//     return m;
//   }

  // Die final distribution after rerolls: returns array { src: 'BV'|'BVminus1', idx, prob }
  function dieFinalDistributionAfterRerolls(dieEntry) {
    const cats = dieEntry.catsBV;
    const R = dieEntry.rerolls || 0;
    if (R === 0) {
      return cats.map((cat, idx) => ({ src: 'BV', idx, prob: cat.prob }));
    }

    let P_miss = 0;
    for (let j = 0; j < cats.length; j++) if (!cats[j].isHit) P_miss += cats[j].prob;

    const attempts = R + 1;
    const finalDist = new Array(cats.length).fill(0);

    if (P_miss >= 1 - 1e-12) {
      // no hit possible -> last attempt distribution
      for (let j = 0; j < cats.length; j++) finalDist[j] = cats[j].prob;
    } else {
      const geomFactor = (1 - Math.pow(P_miss, attempts)) / (1 - P_miss);
      for (let j = 0; j < cats.length; j++) {
        if (cats[j].isHit) {
          finalDist[j] = cats[j].prob * geomFactor;
        } else {
          finalDist[j] = cats[j].prob * Math.pow(P_miss, R);
        }
      }
      // renormalize rounding diffs
      const total = finalDist.reduce((a, b) => a + b, 0);
      if (Math.abs(total - 1) > 1e-12 && total > 0) {
        for (let j = 0; j < finalDist.length; j++) finalDist[j] /= total;
      }
    }
    return finalDist.map((p, idx) => ({ src: 'BV', idx, prob: p }));
  }

  // Compare two candidate keys with third-level special-unit priority.
  // Return 1 if a > b (a preferred), -1 if a < b, 0 if equal.
  // Ordering: higher deltaHits (total normal+special) better; if equal, smaller deltaSpend better;
  // if equal, candidate from special unit preferred.
  function compareCandidatePriority(aDH, aDS, aIsSpecial, bDH, bDS, bIsSpecial) {
    if (aDH > bDH) return 1;
    if (aDH < bDH) return -1;
    if (aDS < bDS) return 1;
    if (aDS > bDS) return -1;
    if (aIsSpecial && !bIsSpecial) return 1;
    if (!aIsSpecial && bIsSpecial) return -1;
    return 0;
  }

  // ---------------------------
  // Build dice entries (shared)
  // ---------------------------
  const diceList = [];
  for (let u = 0; u < units.length; u++) {
    const unit = units[u];
    for (let d = 0; d < unit.dice; d++) {
      let bv = unit.battleValue;
      let rerolls = Math.max(0, unit.rerolls || 0);
      if (crown && unit.immuneCrown) {
        bv = Math.max(1, bv - 1);
        rerolls += 1;
      }
      const entry = {
        unitIndex: u,
        unit,
        bv,
        hitsPerDie: unit.hitsPerDie,
        bonus10: !!unit.bonus10,
        jolnar: !!unit.jolnar,
		argent: !!unit.argent,
        rerolls: rerolls,
        meld: !!unit.meld && d === 0,
        catsBV: null,
        catsBVminus1: null
      };
      entry.catsBV = buildGroupedCategories(entry.bv, entry.bonus10, entry.jolnar, hacans, false, entry.meld, entry.argent);
      entry.catsBVminus1 = buildGroupedCategories(Math.max(1, entry.bv - 1), entry.bonus10, entry.jolnar, hacans, true, entry.meld, entry.argent);
      diceList.push(entry);
    }
  }

  const N = diceList.length;
  if (N === 0) return [];

  // Precompute per-die final choices after rerolls
  const perDieFinalChoices = new Array(N);
  for (let i = 0; i < N; i++) {
    perDieFinalChoices[i] = dieFinalDistributionAfterRerolls(diceList[i]).filter(x => x.prob > 0);
  }

  // Precompute per-die PMFs (canonical P_i)
  const perDiePMFs = new Array(N);
  for (let i = 0; i < N; i++) perDiePMFs[i] = perDieChoicesToPMF(diceList[i], perDieFinalChoices[i]);

  // ---------------------------
  // FAST PATH: !crown && !plasma -> simple convolution
  // ---------------------------
  if (!crown && !plasma) {
    let joint = new Map(); joint.set("0|0|0", 1);
    for (let i = 0; i < N; i++) joint = convolvePMFs(joint, perDiePMFs[i]);
    return aggregateTo3D(joint);
  }

  // ---------------------------
  // Crown-only path: use per-unit PGF formula (efficient)
  // ---------------------------
  if (crown && !plasma) {
    // Build dice indices per unit
    const unitsIndices = [];
    for (let u = 0; u < units.length; u++) unitsIndices.push([]);
    for (let i = 0; i < N; i++) unitsIndices[diceList[i].unitIndex].push(i);

    const perUnitPMFs = [];

    // Helper: compute per-unit PMF using PGF formula (or simple convolution if immune)
    function getUnitPMF(unit, diceIdxs) {
      if (diceIdxs.length === 0) return new Map([["0|0|0", 1]]);
      if (unit.immuneCrown) {
        let unitJoint = new Map(); unitJoint.set("0|0|0", 1);
        for (const di of diceIdxs) unitJoint = convolvePMFs(unitJoint, perDiePMFs[di]);
        return unitJoint;
      }

      const H_factors = [], N_factors = [], M_vals = [], F_factors = [];

      for (const di of diceIdxs) {
        const die = diceList[di];
        const choices = perDieFinalChoices[di];

        const H_map = new Map();
        const N_map = new Map();
        let M_i = 0;
        for (const ch of choices) {
          const cat = die.catsBV[ch.idx];
          const p = ch.prob;
          const extra = cat.extraHits || 0;
		  const extraSpecial = cat.extraSpecial || 0;
          const isSpecialUnit = !!die.unit && !!die.unit.special;
          let hn = 0, hs = 0;
          if (isSpecialUnit) {
            hs = extra + extraSpecial + (cat.isHit ? die.hitsPerDie : 0);
			hn = 0;
          } else {
            hn = extra + (cat.isHit ? die.hitsPerDie : 0);
			hs = extraSpecial;
          }
          const s = cat.isHit ? cat.spent : 0;
          if (cat.isHit) {
            addToMap(H_map, hn, hs, s, p);
          } else {
            addToMap(N_map, hn, hs, s, p);
            M_i += p;
          }
        }

        const F_map = new Map();
        for (const catm of die.catsBVminus1) {
          const extra = catm.extraHits || 0;
		  const extraSpecial = catm.extraSpecial || 0;
          const isSpecialUnit = !!die.unit && !!die.unit.special;
          let hn = 0, hs = 0;
          if (isSpecialUnit) {
            hs = extra + extraSpecial + (catm.isHit ? die.hitsPerDie : 0);
			hn = 0;
          } else {
            hn = extra + (catm.isHit ? die.hitsPerDie : 0);
			hs = extraSpecial;
          }
          const s = catm.isHit ? catm.spent : 0;
          addToMap(F_map, hn, hs, s, catm.prob);
        }

        H_factors.push(H_map);
        N_factors.push(N_map);
        M_vals.push(M_i);
        F_factors.push(F_map);
      }

      // PGF_none = product of N_i
      let PGF_none = new Map(); PGF_none.set("0|0|0", 1);
      for (const Nmap of N_factors) PGF_none = convolvePMFs(PGF_none, Nmap);

      // PGF_HplusMF = product of (H_i + M_i * F_i)
      let PGF_HplusMF = new Map(); PGF_HplusMF.set("0|0|0", 1);
      for (let idx = 0; idx < H_factors.length; idx++) {
        const Hmap = H_factors[idx]; const M = M_vals[idx]; const Fmap = F_factors[idx];
        const MF = scalePMF(Fmap, M);
        const HplusMF = addPMFs(Hmap, MF);
        PGF_HplusMF = convolvePMFs(PGF_HplusMF, HplusMF);
      }

      // PGF_MF = product of (M_i * F_i)
      let PGF_MF = new Map(); PGF_MF.set("0|0|0", 1);
      for (let idx = 0; idx < F_factors.length; idx++) {
        const Fmap = F_factors[idx]; const M = M_vals[idx];
        const MF = scalePMF(Fmap, M);
        PGF_MF = convolvePMFs(PGF_MF, MF);
      }

      const PGF_crownApplied = subtractPMFs(PGF_HplusMF, PGF_MF);
      const PGF_unit = addPMFs(PGF_none, PGF_crownApplied);

      for (const [k, v] of PGF_unit.entries()) if (v < 0 && v > -1e-12) PGF_unit.set(k, 0);
      return PGF_unit;
    }

    for (let u = 0; u < units.length; u++) {
      const pmf = getUnitPMF(units[u], unitsIndices[u]);
      perUnitPMFs.push(pmf);
    }

    // Convolve per-unit PMFs
    let joint = new Map(); joint.set("0|0|0", 1);
    for (const pm of perUnitPMFs) joint = convolvePMFs(joint, pm);

    return aggregateTo3D(joint);
  }

  // ---------------------------
  // Plasma-only path: corrected (no crown, with plasma)
  // ---------------------------
  if (!crown && plasma) {
    // Build per-die category list with useful precomputed values.
    const perDieCats = new Array(N);
    for (let i = 0; i < N; i++) {
      const die = diceList[i];
      const usedBV = die.bv;
      const cats = die.catsBV;
      const arr = [];
      const isSpecialUnit = !!die.unit && !!die.unit.special;

      // face=7 outcome deterministic for usedBV
      const isHit7 = (7 >= (usedBV - hacans));
      const s7 = isHit7 ? Math.max(usedBV - 7, 0) : 0;
      const h7_total = isHit7 ? die.hitsPerDie : 0;
      const h7N = isSpecialUnit ? 0 : h7_total;
      const h7S = isSpecialUnit ? h7_total : 0;

      for (let ci = 0; ci < cats.length; ci++) {
        const cat = cats[ci];
        const ch = perDieFinalChoices[i].find(x => x.idx === ci && x.src === 'BV');
        const p = ch ? ch.prob : 0;
        if (p <= 0) continue;

        const extra = cat.extraHits || 0;
		const extraSpecial = cat.extraSpecial || 0;
        const hN = isSpecialUnit ? 0 : extra + (cat.isHit ? die.hitsPerDie : 0);
        const hS = isSpecialUnit ? extra + extraSpecial + (cat.isHit ? die.hitsPerDie : 0) : extraSpecial;
        const s = cat.isHit ? cat.spent : 0;

        const eligible = ((usedBV - hacans) <= 7) && cat.rollLessThanBV && (cat.rollLessThan7 || cat.has7);

        const deltaH = (h7N + h7S) - (hN + hS);
        const deltaS = s7 - s;

        arr.push({
          idx: ci, p, hN, hS, s,
          eligible, has7: cat.has7,
          deltaH, deltaS,
          h7N, h7S, s7,
          isSpecial: isSpecialUnit
        });
      }

      perDieCats[i] = arr;
    }

    // Build P_no_list: per-die PMF for categories that are NOT eligible
    const P_no_list = [];
    for (let i = 0; i < N; i++) {
      const m = new Map();
      for (const c of perDieCats[i]) {
        if (!c.eligible) addToMap(m, c.hN, c.hS, c.s, c.p);
      }
      P_no_list.push(m);
    }

    // M_none = convolution of all P_no_list (case: no die had an eligible category)
    let M_none = new Map(); M_none.set("0|0|0", 1);
    for (let i = 0; i < N; i++) M_none = convolvePMFs(M_none, P_no_list[i]);

    // Collect distinct thresholds only from ELIGIBLE categories.
    const thresholdMap = new Map();
    const thresholds = [];
    for (let i = 0; i < N; i++) {
      for (const c of perDieCats[i]) {
        if (!c.eligible) continue;
        const key = `${c.deltaH}|${c.deltaS}|${c.isSpecial ? 1 : 0}`;
        if (!thresholdMap.has(key)) {
          thresholdMap.set(key, thresholds.length);
          thresholds.push({ deltaH: c.deltaH, deltaS: c.deltaS, isSpecial: !!c.isSpecial });
        }
      }
    }

    // If there are no eligible categories at all, return M_none
    if (thresholds.length === 0) {
      return aggregateTo3D(M_none);
    }

    // Precompute P_lt and P_le for each threshold and each die.
    const P_lt = []; const P_le = [];
    for (let tIdx = 0; tIdx < thresholds.length; tIdx++) {
      P_lt.push(new Array(N));
      P_le.push(new Array(N));
      const t = thresholds[tIdx];
      for (let i = 0; i < N; i++) {
        const mapLT = new Map();
        const mapLE = new Map();
        for (const c of perDieCats[i]) {
          if (!c.eligible) {
            // Non-eligible categories are always "less" than any eligible key.
            addToMap(mapLT, c.hN, c.hS, c.s, c.p);
            addToMap(mapLE, c.hN, c.hS, c.s, c.p);
            continue;
          }
          const cmp = compareCandidatePriority(c.deltaH, c.deltaS, c.isSpecial, t.deltaH, t.deltaS, t.isSpecial);
          if (cmp < 0) {
            addToMap(mapLT, c.hN, c.hS, c.s, c.p);
            addToMap(mapLE, c.hN, c.hS, c.s, c.p);
          } else if (cmp === 0) {
            addToMap(mapLE, c.hN, c.hS, c.s, c.p);
          }
        }
        P_lt[tIdx][i] = mapLT;
        P_le[tIdx][i] = mapLE;
      }
    }

    // Helper: compute prefix and suffix convolution arrays for a given threshold index
    function computePrefixSuffixForThreshold(tIdx) {
      const pref = new Array(N);
      const suff = new Array(N);
      let acc = new Map(); acc.set("0|0|0", 1);
      for (let i = 0; i < N; i++) {
        acc = convolvePMFs(acc, P_lt[tIdx][i]);
        pref[i] = acc;
      }
      acc = new Map(); acc.set("0|0|0", 1);
      for (let i = N - 1; i >= 0; i--) {
        acc = convolvePMFs(acc, P_le[tIdx][i]);
        suff[i] = acc;
      }
      return { pref, suff };
    }

    // Group eligible categories by threshold index
    const eligibleByThreshold = new Map();
    for (let k = 0; k < N; k++) {
      for (const c of perDieCats[k]) {
        if (!c.eligible) continue;
        const key = `${c.deltaH}|${c.deltaS}|${c.isSpecial ? 1 : 0}`;
        const tIdx = thresholdMap.get(key);
        if (!eligibleByThreshold.has(tIdx)) eligibleByThreshold.set(tIdx, []);
        eligibleByThreshold.get(tIdx).push({ k, cat: c });
      }
    }

    // Start joint with M_none mass (no eligible anywhere)
    let joint = new Map(M_none);

    // For each threshold compute prefix/suffix once and use for all eligible entries at that threshold
    for (const [tIdx, list] of eligibleByThreshold.entries()) {
      const { pref, suff } = computePrefixSuffixForThreshold(tIdx);
      for (const entry of list) {
        const k = entry.k;
        const c = entry.cat;
        // M_kc = pref[k-1] * suff[k+1], handling edges
        let left = (k - 1 >= 0) ? pref[k - 1] : new Map([["0|0|0", 1]]);
        let right = (k + 1 < N) ? suff[k + 1] : new Map([["0|0|0", 1]]);
        const Mkc = convolvePMFs(left, right);

        // shift by face=7 outcome (h7N, h7S, s7) and weight by p_{k,c}
        for (const [ks, probOther] of Mkc.entries()) {
          const [hOtherN, hOtherS, sOther] = ks.split('|').map(Number);
          const finalHN = hOtherN + c.h7N;
          const finalHS = hOtherS + c.h7S;
          const finalS = sOther + c.s7;
          addToMap(joint, finalHN, finalHS, finalS, probOther * c.p);
        }
      }
    }

    return aggregateTo3D(joint);
  }

  // ---------------------------
  // Fallback: handle crown && plasma (or cases not caught above)
  // This enumerates per-die choices (after rerolls), applies crown rerolls, then plasma; updated for special units
  // ---------------------------

  const perDieOptions = new Array(N);
  for (let i = 0; i < N; i++) {
    perDieOptions[i] = perDieFinalChoices[i]; // array {src, idx, prob}
  }

  const jointProb = new Map();
  const chosenAfterRerolls = new Array(N);

  function enumerateAfterRerolls(i) {
    if (i === N) {
      let pInit = 1;
      const chosenArr = new Array(N);
      for (let j = 0; j < N; j++) {
        const opt = perDieOptions[j][chosenAfterRerolls[j]];
        pInit *= opt.prob;
        chosenArr[j] = { src: opt.src, idx: opt.idx };
      }
      processCrownStage(chosenArr, pInit);
      return;
    }
    const options = perDieOptions[i];
    for (let opt = 0; opt < options.length; opt++) {
      chosenAfterRerolls[i] = opt;
      enumerateAfterRerolls(i + 1);
    }
  }

  function processCrownStage(chosenArr, pathProb) {
    if (!crown) {
      finalizeScenario(chosenArr, pathProb);
      return;
    }
    const unitMap = {};
    for (let i = 0; i < N; i++) {
      const u = diceList[i].unitIndex;
      if (!unitMap[u]) unitMap[u] = [];
      unitMap[u].push(i);
    }
    const crownRerollIndices = [];
    for (const uKey of Object.keys(unitMap)) {
      const uIdx = Number(uKey);
      const idxs = unitMap[uIdx];
      if (units[uIdx].immuneCrown) continue;
      let hasAHit = false;
      for (const di of idxs) {
        const ch = chosenArr[di];
        const cat = (ch.src === 'BV') ? diceList[di].catsBV[ch.idx] : diceList[di].catsBVminus1[ch.idx];
        if (cat.isHit) { hasAHit = true; break; }
      }
      if (hasAHit) {
        for (const di of idxs) {
          const ch = chosenArr[di];
          const cat = (ch.src === 'BV') ? diceList[di].catsBV[ch.idx] : diceList[di].catsBVminus1[ch.idx];
          if (!cat.isHit) crownRerollIndices.push(di);
        }
      }
    }
    if (crownRerollIndices.length === 0) {
      finalizeScenario(chosenArr, pathProb);
      return;
    }
    const K = crownRerollIndices.length;
    const crownChoice = new Array(K);
    function recurseCrown(rk) {
      if (rk === K) {
        const afterCrown = chosenArr.slice();
        let extraP = 1;
        for (let j = 0; j < K; j++) {
          const di = crownRerollIndices[j];
          const cats = diceList[di].catsBVminus1;
          const ci = crownChoice[j];
          afterCrown[di] = { src: 'BVminus1', idx: ci };
          extraP *= cats[ci].prob;
        }
        finalizeScenario(afterCrown, pathProb * extraP);
        return;
      }
      const dieIdx = crownRerollIndices[rk];
      const cats = diceList[dieIdx].catsBVminus1;
      for (let ci = 0; ci < cats.length; ci++) {
        crownChoice[rk] = ci;
        recurseCrown(rk + 1);
      }
    }
    recurseCrown(0);
  }

  function finalizeScenario(finalChosenArr, finalProb) {
    const infos = [];
    for (let i = 0; i < N; i++) {
      const ch = finalChosenArr[i];
      const usedArray = (ch.src === 'BV') ? diceList[i].catsBV : diceList[i].catsBVminus1;
      const cat = usedArray[ch.idx];
      const usedBV = (ch.src === 'BV') ? diceList[i].bv : Math.max(1, diceList[i].bv - 1);
      infos.push({
        dieIndex: i,
        unitIndex: diceList[i].unitIndex,
        hitsPerDie: diceList[i].hitsPerDie,
        cat,
        usedBV,
        usedSrc: ch.src,
        bonus10: diceList[i].bonus10,
        jolnar: diceList[i].jolnar,
        isSpecial: !!diceList[i].unit && !!diceList[i].unit.special
      });
    }

    // Plasma selection (if any)
    if (plasma) {
      const candidates = [];
      for (let i = 0; i < N; i++) {
        const info = infos[i];
        if ((info.usedBV - hacans) <= 7 && info.cat.rollLessThanBV && (info.cat.rollLessThan7 || info.cat.has7)) {
          const extra = info.cat.extraHits || 0;
		  const extraSpecial = info.cat.extraSpecial || 0;
          let curHN = 0, curHS = 0;
          if (info.isSpecial) {
            curHS = extra + extraSpecial + (info.cat.isHit ? info.hitsPerDie : 0);
			curHN = 0;
          } else {
            curHN = extra + (info.cat.isHit ? info.hitsPerDie : 0);
			curHS = extraSpecial;
          }
          const curHTotal = curHN + curHS;
          const curS = info.cat.isHit ? info.cat.spent : 0;
          const isHit7 = (7 >= (info.usedBV - hacans));
          const s7 = isHit7 ? Math.max(info.usedBV - 7, 0) : 0;
          const h7_total = (isHit7 ? info.hitsPerDie : 0);
          const h7N = info.isSpecial ? 0 : h7_total;
          const h7S = info.isSpecial ? h7_total : 0;
          const deltaH = (h7N + h7S) - curHTotal; // total hits delta
          const deltaS = s7 - curS;
          candidates.push({
            idx: i, deltaH, deltaS, h7N, h7S, curHN, curHS, curS, isSpecial: info.isSpecial
          });
        }
      }

      if (candidates.length > 0) {
        let best = candidates[0];
        for (let t = 1; t < candidates.length; t++) {
          const cand = candidates[t];
          const cmp = compareCandidatePriority(cand.deltaH, cand.deltaS, cand.isSpecial, best.deltaH, best.deltaS, best.isSpecial);
          if (cmp > 0 || (cmp === 0 && cand.idx < best.idx)) {
            best = cand;
          }
        }
        const chosenPlasmaIndex = best.idx;
        const chosenDie = diceList[chosenPlasmaIndex];
        const usedSrc = infos[chosenPlasmaIndex].usedSrc;
        const catArray = (usedSrc === 'BV') ? chosenDie.catsBV : chosenDie.catsBVminus1;
        let catFor7 = null;
        for (let ci = 0; ci < catArray.length; ci++) {
          if (catArray[ci].has7) { catFor7 = catArray[ci]; break; }
        }
        if (!catFor7) {
          const usedBV = infos[chosenPlasmaIndex].usedBV;
          const isH7 = (7 >= (usedBV - hacans));
          const spent7 = isH7 ? Math.max(usedBV - 7, 0) : 0;
          catFor7 = { faces: [7], prob: 1 / dieSides, isHit: isH7, spent: spent7, extraHits: 0, rollLessThanBV: 7 < usedBV, rollLessThan7: false, has7: true };
        }
        infos[chosenPlasmaIndex].cat = catFor7;
      }
    }

    // sum normal and special hits separately and spent
    let hitsN = 0; let hitsS = 0; let spent = 0;
    for (let i = 0; i < N; i++) {
      const info = infos[i];
      const extra = info.cat.extraHits || 0;
	  const extraSpecial = info.cat.extraSpecial || 0;
      if (info.isSpecial) {
        hitsS += extra + extraSpecial;
      } else {
        hitsN += extra;
		hitsS += extraSpecial;
      }
      if (info.cat.isHit) {
        if (info.isSpecial) {
          hitsS += info.hitsPerDie;
        } else {
          hitsN += info.hitsPerDie;
        }
        spent += info.cat.spent;
      }
    }

    const key = `${hitsN}|${hitsS}|${spent}`;
    jointProb.set(key, (jointProb.get(key) || 0) + finalProb);
  }

  // Start fallback enumeration
  enumerateAfterRerolls(0);

  return aggregateTo3D(jointProb);
}



		

		



















		


		function test(units, crown, plasma, hacans) {
			const dieSides = 10;

			function extraHits(unit) {
				return function (die) {
				var output = 0;
				if (unit.bonus10) { output += die === 10 ? 1 : 0; }
				if (unit.jolnar) { output += (die === 10 || die === 9) ? 2 : 0; }
				return output;
				};
			}

			function extraHitsSpecial(unit) {
				return function (die) {
					var output = 0;
					if (unit.argent) { output += (die === 10 || die === 9) ? 1 : 0; }
					
					return output;
				};
			}

			const rolls = 1e7; // number of trials
			// 2D marginal histograms keyed by "n|sp"
			const histogram2D = {};         // counts for (normalHits, specialHits)
			const histogramSpends2D = {};   // total spend for (normalHits, specialHits)
			// 3D full joint histogram keyed by "n|sp|s"
			const histogram3D = {};         // counts for (normalHits, specialHits, spend)

			for (var j = 0; j < rolls; j++) {
				var [nHits, spHits, spent] = singleRoll();

				const key2D = `${nHits}|${spHits}`;
				histogram2D[key2D] = (histogram2D[key2D] || 0) + 1;
				histogramSpends2D[key2D] = (histogramSpends2D[key2D] || 0) + spent;

				const key3D = `${nHits}|${spHits}|${spent}`;
				histogram3D[key3D] = (histogram3D[key3D] || 0) + 1;
			}

			// convert to matrices: find max n, max sp, and max spend
			const pairs2D = Object.keys(histogram2D).map(k => k.split('|').map(Number));
			const triples3D = Object.keys(histogram3D).map(k => k.split('|').map(Number));
			const maxN = pairs2D.length ? Math.max(...pairs2D.map(p => p[0])) : 0;
			const maxSp = pairs2D.length ? Math.max(...pairs2D.map(p => p[1])) : 0;
			const maxS = triples3D.length ? Math.max(...triples3D.map(t => t[2])) : 0;

			const probMatrix = Array.from({ length: maxN + 1 }, () => new Array(maxSp + 1).fill(0));
			const expectedSpendMatrix = Array.from({ length: maxN + 1 }, () => new Array(maxSp + 1).fill(0));

			for (let n = 0; n <= maxN; n++) {
				for (let sp = 0; sp <= maxSp; sp++) {
				const key = `${n}|${sp}`;
				const count = histogram2D[key] || 0;
				const p = count / rolls;
				probMatrix[n][sp] = p;
				expectedSpendMatrix[n][sp] = count > 0 ? (histogramSpends2D[key] / count) : 0;
				}
			}

			// Build full 3D probability array (prob3D[n][sp][s] = probability)
			const prob3D = Array.from({ length: maxN + 1 }, () =>
				Array.from({ length: maxSp + 1 }, () => new Array(maxS + 1).fill(0))
			);
			for (const key of Object.keys(histogram3D)) {
				const [n, sp, s] = key.split('|').map(Number);
				const count = histogram3D[key];
				prob3D[n][sp][s] = (prob3D[n][sp][s] || 0) + (count / rolls);
			}

			return [probMatrix, expectedSpendMatrix, prob3D];

			// ---------- singleRoll now tracks normal & special hits ----------
			function singleRoll() {
				var allDice = [];

				for (const unit of units) {
				var dice = [];

				for (var i = 0; i < unit.dice; i++) {
					var spent = 0;
					var battleValue = unit.battleValue;
					var dieRoll = Math.floor(Math.random() * dieSides + 1);
					var rerolls = unit.rerolls || 0;

					if (unit.immuneCrown && crown) {
					battleValue = Math.max(1, battleValue - 1);
					rerolls += 1;
					}

					if (unit.meld && i == 0) {
					dieRoll = Math.min(dieRoll + Math.floor(Math.random() * dieSides + 1), 10);
					}

					// perform rerolls (rerolls attempts)
					while (rerolls > 0 && dieRoll < (battleValue - hacans)) {
					dieRoll = Math.floor(Math.random() * dieSides + 1);
					if (unit.meld && i == 0) {
						dieRoll = Math.min(dieRoll + Math.floor(Math.random() * dieSides + 1), 10);
					}
					rerolls--;
					}

					// store: [face, BV, hitsPerDie, extraHitsFn, isMeld, unitSpecialFlag, unitIndex]
					dice.push([dieRoll, battleValue, unit.hitsPerDie, extraHits(unit), unit.meld && i === 0, !!unit.special, unit, extraHitsSpecial(unit)]);
				}

				const hasAHit = dice.some(roll => roll[0] >= (roll[1] - hacans));

				if (hasAHit && crown && !unit.immuneCrown) {
					for (const die of dice) {
					if (die[0] < (die[1] - hacans)) {
						die[0] = Math.floor(Math.random() * dieSides + 1);
						if (die[4]) {
						die[0] = Math.min(die[0] + Math.floor(Math.random() * dieSides + 1), 10);
						}
						die[1] = Math.max(die[1] - 1, 1);
					}
					}
				}

				// attach the unit info for plasma tie-break decisions
				allDice = allDice.concat(dice);
				}

				// Plasma: candidate selection with special-unit tie-break
				if (plasma) {
				// candidate dice: usedBV - hacans <= 7 AND current roll < BV AND some relation for 7
				const candidates = allDice.map((die, idx) => ({ die, idx }))
					.filter(({ die }) => (die[1] - hacans) <= 7 && die[0] < die[1] && die[0] < 7);

				if (candidates.length > 0) {
					function scoreFor({ die }) {
					const beforeHit = die[0] >= (die[1] - hacans) ? die[2] : 0; // hits already achieved (hitsPerDie)
					const beforeExtra = die[3](die[0]); // extra hits from bonus/jolnar
					const beforeSpent = die[0] >= (die[1] - hacans) ? Math.max(die[1] - die[0], 0) : 0;

					const afterRoll = 7;
					const afterHit = afterRoll >= (die[1] - hacans) ? die[2] : 0;
					const afterExtra = die[3](afterRoll);
					const afterSpent = afterRoll >= (die[1] - hacans) ? Math.max(die[1] - afterRoll, 0) : 0;

					return [
						(afterHit + afterExtra) - (beforeHit + beforeExtra), // delta total hits (normal+special)
						beforeSpent - afterSpent // delta spend (positive means saving)
					];
					}

					// pick best candidate by lexicographic ordering: delta hits, then delta spend, then special-unit preference, then lower index
					let best = candidates[0];
					let bestScore = scoreFor(best);
					for (let k = 1; k < candidates.length; k++) {
					const cand = candidates[k];
					const sc = scoreFor(cand);
					// lexicographic compare
					let greater = false;
					if (sc[0] > bestScore[0]) greater = true;
					else if (sc[0] < bestScore[0]) greater = false;
					else {
						if (sc[1] > bestScore[1]) greater = true;
						else if (sc[1] < bestScore[1]) greater = false;
						else {
						// tie on deltaH and deltaS: prefer candidate from a special unit
						const candIsSpecial = !!cand.die[5];
						const bestIsSpecial = !!best.die[5];
						if (candIsSpecial && !bestIsSpecial) greater = true;
						else if (!candIsSpecial && bestIsSpecial) greater = false;
						else {
							// final tie-break: lower original array index (stable)
							greater = cand.idx < best.idx;
						}
						}
					}
					if (greater) { best = cand; bestScore = sc; }
					}

					// set chosen die face to 7
					allDice[best.idx][0] = 7;
				}
				}

				// tally normal and special hits and spent
				var nHits = 0, spHits = 0, spent = 0;
				for (const die of allDice) {
					const extra = die[3](die[0]);
					const extraSpecial = die[7](die[0]);
					const didHit = die[0] >= (die[1] - hacans);
					if (die[5]) {
						// special unit: accumulate special hits
						spHits += extra + extraSpecial;
						spHits += didHit ? die[2] : 0;
					} else {
						nHits += extra;
						nHits += didHit ? die[2] : 0;
						spHits += extraSpecial;
					}
					if (didHit) spent += Math.max(die[1] - die[0], 0);
				}

				return [nHits, spHits, spent];
			}
		}




		function computeFleetTransitions2(fleet, opponentFleet, battleSide, battleType, thisSideResources, throwType, thisSideFlags, thisSideOptions) {
			
			var result = [1];
			var resultPlasmaViable = [1];
			var resultSpecial = [1];
			var resultSpecialPlasmaViable = [1];
			


			

			// var A3 = [{pmf: [0.9,0,0, 0.1], spentTgs:[0,0.1]}]
			// var A2 = [{pmf: [0.4,0,0.6], spentTgs:[0,0.1]}]
			// var A1 = [{pmf: [0.7, 0.3], spentTgs:[0,0.1]}]
			// var A0 = []

			// var A3 = []
			// var A2 = []
			// var A1 = [{pmf: [0.4, 0.6], spentTgs:[0,1/6]},{pmf: [0.4, 0.6], spentTgs:[0,1/6]}]
			// var A0 = []

			// const output = completeCalcWithExpectations([A0, A1, A2, A3]);
			// print(output);

			
			

			const [boostFunction, boostRollFunction, rerollFunction] = getBoostFunctions(fleet, opponentFleet, battleSide, battleType, thisSideResources, throwType, thisSideFlags, thisSideOptions, false);


			

			const specialUnitFunction = getSpecialUnitFunction(fleet, opponentFleet, battleSide, battleType, thisSideResources, throwType, thisSideFlags, thisSideOptions);
	



			var actuallyPlasma = thisSideOptions.plasmaScoringC && (throwType === game.ThrowType.SpaceCannon || throwType === game.ThrowType.Bombardment || throwType === game.ThrowType.Barrage);
			
			for (var a = 0; a < fleet.length; a++) {
				var unit = fleet[a];
				const [thisUnitTransitions,plasmaViable] = computeUnitTransitions2(unit, throwType, boostFunction, boostRollFunction, rerollFunction,thisSideOptions);



				
				

				if (specialUnitFunction(unit)){
					if (plasmaViable && actuallyPlasma){
						resultSpecialPlasmaViable = slideMultiply(resultSpecialPlasmaViable, thisUnitTransitions);
					} else {
						resultSpecial = slideMultiply(resultSpecial, thisUnitTransitions);
					}
				} else {
				
					if (plasmaViable && actuallyPlasma){
						resultPlasmaViable = slideMultiply(resultPlasmaViable, thisUnitTransitions);
					} else {
						result = slideMultiply(result, thisUnitTransitions);
					}
				}


				
			}

			if (actuallyPlasma){
				resultPlasmaViable.unshift(0);
				var last = resultPlasmaViable.pop();
				resultPlasmaViable[resultPlasmaViable.length - 1] += last;

				result = slideMultiply(result, resultPlasmaViable);

				resultSpecialPlasmaViable.unshift(0);
				last = resultSpecialPlasmaViable.pop();
				resultSpecialPlasmaViable[resultSpecialPlasmaViable.length - 1] += last;


				// not accounting for additional hits from number rolled correctly
				// not account for rolls that produce multiple hits correclty. maybe (shift by 2 for the units that shift by 2)
				resultSpecial = slideMultiply(resultSpecial, resultSpecialPlasmaViable);

				// how to implement with hacan + 1
				// get the expected tgs spent, multiply by prob vector, then shift by 1, add at the end, then subtract by the probability that you only got hits that you don't need to spend for
			}
			
			
			
			return [result, resultSpecial];
		}

		function getSpaceCannonTransition(fleetFull, opponentFleetFull, battleSide, battleType, thisSideResources, thisSideFlags, thisSideOptions) {

			function useSpaceCannon(unit) {
				return unit.spaceCannonDice !== 0 && !unit.lostSpaceCannon && !unit.notUseSpaceCannon;
			}
			
			var spaceCannonFleet = fleetFull.filter(useSpaceCannon);

			if (spaceCannonFleet.length === 0) return [[[1]]];
			
			return computeFleetTransitionsWrapper(spaceCannonFleet, opponentFleetFull, battleSide, battleType, thisSideResources, game.ThrowType.SpaceCannon, thisSideFlags, thisSideOptions)

		}

		function getBombardmentTransition(fleetFull, opponentFleetFull, battleSide, battleType, thisSideResources, thisSideFlags, thisSideOptions) {

			function useBombardment(unit) {
				return unit.bombardmentDice !== 0 && !unit.lostBombardment && !unit.notUseBombardment;
			}
			
			var bombardmentFleet = fleetFull.filter(useBombardment);

			var noBombardment = opponentFleetFull.some(obj => 
				obj.planetaryShield && !obj.notInSystem && obj.planet && !obj.lostPlanetaryShield && !obj.notUsePlanetaryShield);
			// noBombardment=false;

			if (bombardmentFleet.length === 0 || noBombardment) return [[[1]]];
			
			return computeFleetTransitionsWrapper(bombardmentFleet, opponentFleetFull, battleSide, battleType, thisSideResources, game.ThrowType.Bombardment, thisSideFlags, thisSideOptions)

		}

		function getBarrageTransition(fleetFull, opponentFleetFull, battleSide, battleType, thisSideResources, thisSideFlags, thisSideOptions) {

			function useBarrage(unit) {
				return unit.barrageDice !== 0 && !unit.lostBarrage && !unit.notUseBarrage;
			}
			
			var barrageFleet = fleetFull.filter(useBarrage);

			if (barrageFleet.length === 0) return [[[1]]];
			
			return computeFleetTransitionsWrapper(barrageFleet, opponentFleetFull, battleSide, battleType, thisSideResources, game.ThrowType.Barrage, thisSideFlags, thisSideOptions)

		}
			
		




		function computeFleetTransitions(fleet, throwType, modifier, modifierRoll, reroll, thisSideOptions) {
			modifier = modifier || 0;
			modifierRoll = modifierRoll || 0;
			var result = [[1]];
			var transitions=[]
			for (var a = 0; a < fleet.length; a++) {
				var unit = fleet[a];
				unit.dead = false;
				var thisUnitTransitions = computeUnitTransitions(unit, throwType, modifier, modifierRoll, reroll,thisSideOptions);
				thisUnitTransitions.unit=unit;
				transitions.push(thisUnitTransitions);



				result.push(slideMultiply(thisUnitTransitions, result[a]));
			}
			result[fleet.length].transitions=transitions;
			// if (thisSideOptions.infantryIIA || thisSideOptions.infantryIID){
			// 	for (var a = 1; a < result.length-1; a++){
			// 		var infantryTransition = [1];
			// 		for (var i=a; i < fleet.length; i++){
			// 			var unit = fleet[i];
			// 			if (unit.type === game.UnitType.Ground){
			// 				unit.dead = true;
			// 				infantryTransition = slideMultiply(computeUnitTransitions(unit, throwType, modifier, modifierRoll, reroll,thisSideOptions),infantryTransition);
			// 			}
			// 		}
			// 		result[a]=slideMultiply(result[a],infantryTransition);
			// 	}
			// }
			
			return result;
		}



		/** Compute probabilities of the unit inflicting 0, 1, etc. hits.
		 * @param reroll is used for units that can reroll failed throws */
		function computeUnitTransitions(unit, throwType, modifier, modifierRoll, reroll, thisSideOptions) {
			var battleValue = unit[game.ThrowValues[throwType]];
			var diceCount = unit[game.ThrowDice[throwType]];
			modifier = modifier || 0;
			modifierRoll = modifierRoll || 0;
			var modifierFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifier === 'function' ? modifier(unit) : modifier;
			};
			var modifierRollFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifierRoll === 'function' ? modifierRoll(unit) : modifierRoll;
			};
			var singleDie = [];
			var diceRolls=diceCount + modifierRollFunction(unit);
			var oneRollMiss = Math.max(Math.min((battleValue - 1 - modifierFunction(unit)) / game.dieSides, 1), 0);
			if (diceRolls===0) return [1];
			// if (unit.type === game.UnitType.Flagship && unit.faction === game.Faction.JolNar && throwType === game.ThrowType.Battle) {
			// 	var oneRollHit = 1 - oneRollMiss;
			// 	var oneRollZeroHit = Math.min(0.8, oneRollMiss);
			// 	var oneRollOneHit = Math.max(0, (oneRollHit - 0.2)); // hit, but not 9 or 0 on the die
			// 	if (thisSideOptions.crownThalnosC){
			// 		var oneRollTwoHit = 0.1*(oneRollHit<=0.1); // +2 hits, but not a regular hit somehow.
			// 		var oneRollThreeHit = 0.1*(oneRollHit>=0.2) + 0.1*(oneRollHit<=0);
			// 		var oneRollFourHit = Math.min(0.1,oneRollHit);
			// 	}
			// 	else {
			// 		var oneRollTwoHit = Math.max(0, 0.2 - oneRollHit); // +2 hits, but not a regular hit somehow.
			// 		var oneRollThreeHit = Math.min(0.2, oneRollHit);
			// 	}
			// 	singleDie[0] = oneRollZeroHit * (reroll ? oneRollZeroHit : 1); // miss both on first roll and reroll
			// 	singleDie[1] = oneRollOneHit + (reroll ? oneRollMiss * oneRollOneHit : 0); // hit on first roll or hit on reroll
			// 	singleDie[2] = oneRollTwoHit + (reroll ? oneRollMiss * oneRollTwoHit : 0);
			// 	singleDie[3] = oneRollThreeHit + (reroll ? oneRollMiss * oneRollThreeHit : 0);
			// 	if (thisSideOptions.crownThalnosC)
			// 		singleDie[4] = oneRollFourHit + (reroll ? oneRollMiss * oneRollFourHit : 0);
			// } else {
			// 	if (thisSideOptions.crownThalnosC){
			// 		var oneRollHit = 1 - oneRollMiss;
			// 		var oneRollZeroHit = Math.min(0.9, oneRollMiss);
			// 		var oneRollOneHit = Math.max(0, (oneRollHit - 0.1)) + Math.max(0, 0.1 - oneRollHit);
			// 		var oneRollTwoHit = Math.min(0.1, oneRollHit);
			// 		singleDie[0] = oneRollZeroHit * (reroll ? oneRollZeroHit : 1); // miss both on first roll and reroll
			// 		singleDie[1] = oneRollOneHit + (reroll ? oneRollMiss * oneRollOneHit : 0); // hit on first roll or hit on reroll
			// 		singleDie[2] = oneRollTwoHit + (reroll ? oneRollMiss * oneRollTwoHit : 0);
			// 	}
			// 	else {
					singleDie[0] = oneRollMiss;
					if (reroll)
						singleDie[0] = singleDie[0] * singleDie[0];
					singleDie[1] = 1 - singleDie[0];
			// 	}
			// }
			var result = singleDie;
			for (var i = 1; i < (diceCount + modifierRollFunction(unit)); i++) {
				result = slideMultiply(result, singleDie);
			}
			// if (thisSideOptions.crownThalnosSafe && diceRolls>1 && throwType == game.ThrowType.Battle){
			// 	var temp1=result;
			// 	var oneRollMissNew= Math.max(Math.min((battleValue - 1 - modifierFunction(unit)-1) / game.dieSides, 1), 0);
			// 	for (var i=diceRolls-1; i>0;i--){
			// 		var temp = chanceList(oneRollMissNew,diceRolls-i);
			// 		var k = temp1[i];
			// 		temp1[i]=0;
			// 		for (var j=0;j<temp.length;j++){
			// 			temp1[i+j]=temp[j]*k+temp1[i+j];
			// 		}
			// 	}
			// 	result=temp1;
			// }
			while(result[result.length-1] === 0){ // While the last element is a 0,
				result.pop();                  // Remove that last element
			}
			return result;
		}
		function moreDieForStrongestUnit(fleet, throwType, dice){
			return function(unit) {
				return (unit === getUnitWithLowest(fleet, game.ThrowValues[throwType])) ? dice : 0;
			}
		}


		/** Multiply two transition arrays to produce probabilities of total hits being 0, 1, 2 etc. */
		function slideMultiply(transitions1, transitions2) {
			var result = [];
			for (var i = 0; i < transitions1.length + transitions2.length - 1; ++i)
				result[i] = 0;
			for (var i1 = 0; i1 < transitions1.length; ++i1) {
				for (var i2 = 0; i2 < transitions2.length; ++i2)
					result[i1 + i2] += transitions1[i1] * transitions2[i2];
			}
			return result;
		}



		function orthogonalMultiplyMatrix(transitions1, transitions2){
			const result = Array.from({ length: transitions1.length }, () => new Array(transitions2.length));
			for (let i = 0; i < transitions1.length; i++) {
				const ai = transitions1[i];
				for (let j = 0; j < transitions2.length; j++) {
					result[i][j] = ai * transitions2[j];
				}
			}
			result.rows = transitions1.length;
			result.columns = transitions2.length;
			return result
		}

		function orthogonalMultiplyMatrixSpecial(transitions1, transitions2, transitions3, transitions4){
			const result = Array.from({ length: transitions1.length }, () =>
				Array.from({ length: transitions2.length }, () =>
				Array.from({ length: transitions3.length }, () =>
					new Array(transitions4.length)
				)
				)
			);

			for (let i = 0; i < transitions1.length; i++) {
				const a = transitions1[i];
				for (let j = 0; j < transitions2.length; j++) {
					const b = transitions2[j];
					for (let k = 0; k < transitions3.length; k++) {
						const c = transitions3[k];
						for (let l = 0; l < transitions4.length; l++) {
							result[i][j][k][l] = a * b * c * transitions4[l];
						}	
					}
				}
			}

			// optional metadata, similar to your original
			result.rows = transitions1.length;
			result.columns = transitions2.length;
			result.dim3 = transitions3.length;
			result.dim4 = transitions4.length;

			return result;
		}

		function orthogonalMultiplyMatrix2DSpecial(A, B) {

			const dim1A = A.length;
			const dim2A = A[0].length;
			const dim1B = B.length;
			const dim2B = B[0].length;

			const result = Array.from({ length: dim1A }, () =>
				Array.from({ length: dim1B }, () =>
				Array.from({ length: dim2A }, () =>
					new Array(dim2B).fill(0)
				)
				)
			);

			for (let i = 0; i < dim1A; i++) {
				for (let j = 0; j < dim1B; j++) {
				for (let k = 0; k < dim2A; k++) {
					for (let l = 0; l < dim2B; l++) {
					result[i][j][k][l] = A[i][k] * B[j][l];
					}
				}
				}
			}

			result.rows = dim1A;
			result.columns = dim1B;
			result.dim3 = dim2A;
			result.dim4 = dim2B;

			return result;
		}

		function orthogonalMultiplyMatrix3DSpecial(A, B) {

			const dim1A = A.length;
			const dim2A = A[0].length;
			const dim3A = A[0][0].length;

			const dim1B = B.length;
			const dim2B = B[0].length;
			const dim3B = B[0][0].length;

			// Initialize 6D result array: [dim1A][dim1B][dim2A][dim2B][dim3A][dim3B]
			const result = Array.from({ length: dim1A }, () =>
				Array.from({ length: dim1B }, () =>
				Array.from({ length: dim2A }, () =>
					Array.from({ length: dim2B }, () =>
					Array.from({ length: dim3A }, () =>
						new Array(dim3B).fill(0)
					)
					)
				)
				)
			);

			// Compute orthogonal product
			for (let i = 0; i < dim1A; i++) {
				for (let j = 0; j < dim1B; j++) {
				for (let k = 0; k < dim2A; k++) {
					for (let l = 0; l < dim2B; l++) {
					for (let m = 0; m < dim3A; m++) {
						for (let n = 0; n < dim3B; n++) {
						result[i][j][k][l][m][n] = A[i][k][m] * B[j][l][n];
						}
					}
					}
				}
				}
			}

			// Optionally attach dimension metadata
			result.rows = dim1A;
			result.columns = dim1B;
			result.dim3 = dim2A;
			result.dim4 = dim2B;
			result.dim5 = dim3A;
			result.dim6 = dim3B;

			return result;
		}
		




		function initContinuousUnitAbilities(){
			return {
				'mentakFlagship': {
					
					timing: 'beforeCombat_',
					condition: function(fleet,opponentFleet, battleSide, battleType,thisSideResources, thisSideFlags, unit, thisSideOptions ){
						return !unit.notInSystem;
					},
					effect: function(fleet, opponentFleet, battleSide, battleType,  thisSideResources, thisSideFlags, otherSideFlags, options, activeUnit, state, accumulation){


						const otherSide = game.BattleSide.opponent(battleSide);

						const flag = {
							name: 'mentakFlagship',
							shortType: 'MKF',
							duration: -1,
							unitPointer: null,
							side: otherSide,
							newUnitEffect: this.newUnitEffect,
						};
						
						otherSideFlags.push(flag);
						activeUnit.flagPointers.push(flag);
						flag.unitPointer = activeUnit;

						applyContinuousEffectsOnUnits(opponentFleet, otherSideFlags, otherSide, battleType, state.timing, options[otherSide]);
						
						

						

						
					},
					

					deathEffect: function(deadUnit, fleet, opponentFleet, battleType, thisSideOptions, otherSideOptions, thisSideFlags, otherSideFlags){

						
						

						for (var i = 0; i < opponentFleet.length; i++) {
							const unit = opponentFleet[i];
							if (unit.typeShip){
								unit.update({notUseSustain: false});
							}
						}
					
					},

					newUnitEffect: function(unit){

						if (unit.typeShip){
							unit.update({notUseSustain: true});
						}

						if (unit.isDamageGhost && unit.typeShip){

							if (unit.damageCorporeal){
								unit.damageCorporeal.ghostCorporeal=undefined;
							}
							
							return false;
						};
						

						return true;
					},


					
					priority:-1,
				},
				'mentakMech': {
					
					timing: 'spaceCannonDefense_',
					
					condition: function(fleet,opponentFleet, battleSide, battleType,thisSideResources, thisSideFlags, unit, thisSideOptions ){
						return battleType === 'Ground' && !unit.notInSystem && unit.planet;
					},
					effect: function(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, otherSideFlags, options, activeUnit, state, accumulation){
						// for (var i = opponentFleet.length-1; i >= 0; i--) {
						// 	const unit = opponentFleet[i];
						// 	if (unit.isDamageGhost && unit.typeGroundForce){
						// 		unit.damageCorporeal.ghostCorporeal=undefined;
						// 		opponentFleet.splice(i,1);
						// 	}
						// }

						// const flag = {
						// 	name: 'mentakMech',
						// 	shortType: 'MKM',
						// 	duration: -1,
						// 	unitPointer: null,
						// 	side: battleSide === 'attacker' ? 'defender' : 'attacker',
						// };
						
						// otherSideFlags.push(flag);
						// activeUnit.flagPointers.push(flag);

						// flag.unitPointer = activeUnit;

						const otherSide = game.BattleSide.opponent(battleSide);

						const flag = {
							name: 'mentakMech',
							shortType: 'MKM',
							duration: -1,
							unitPointer: null,
							side: otherSide,
							newUnitEffect: this.newUnitEffect,
						};
						
						otherSideFlags.push(flag);
						activeUnit.flagPointers.push(flag);
						flag.unitPointer = activeUnit;

						applyContinuousEffectsOnUnits(opponentFleet, otherSideFlags, otherSide, battleType, state.timing, options[otherSide]);
					},
					deathEffect: function(deadUnit, fleet, opponentFleet, battleType, thisSideOptions, otherSideOptions, thisSideFlags, otherSideFlags){

						
						// const hasFlag = otherSideFlags.some(obj => obj.name == this.name);
						// if (!hasFlag){
							

						// 	for (var i = 0; i < opponentFleet.length; i++) {
						// 		const unit = opponentFleet[i];
						// 		if (unit.sustainDamage && !unit.damaged && !unit.lostSustain && !unit.notUseSustain && unit.ghostCorporeal === undefined){
				
						// 			const sustain=unit.toDamageGhost();
						// 			addUnit(opponentFleet, sustain, battleType, otherSideFlags, otherSideOptions, true);
						// 			game.fleetSort(opponentFleet, otherSideOptions);
						// 		}
						// 	}
						// }
						for (var i = 0; i < opponentFleet.length; i++) {
							const unit = opponentFleet[i];
							if (unit.typeGroundForce){
								unit.update({notUseSustain: false});
							}
						}
					
					},
					newUnitEffect: function(unit){

						if (unit.typeGroundForce){
							unit.update({notUseSustain: true});
						}

						if (unit.isDamageGhost && unit.typeGroundForce){

							if (unit.damageCorporeal){
								unit.damageCorporeal.ghostCorporeal=undefined;
							}
							
							return false;
						};
						

						return true;
					},
					priority:-1,
				},
				'l1z1xFlagship': {
					
					timing: 'duringCombat_',
					
					condition: function(fleet,opponentFleet, battleSide, battleType,thisSideResources, thisSideFlags, unit, thisSideOptions ){
						return battleType === 'Space' && !unit.notInSystem;
					},
					effect: function(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, otherSideFlags, options, activeUnit, state, accumulation){
						

						const flag = {
							name: 'l1z1xFlagship',
							shortType: 'L1F',
							duration: -1,
							unitPointer: null,
							side: battleSide,
						};
						
						thisSideFlags.push(flag);
						activeUnit.flagPointers.push(flag);

						flag.unitPointer = activeUnit;
					},
					deathEffect: function(deadUnit, fleet, opponentFleet, battleType, thisSideOptions, otherSideOptions, thisSideFlags, otherSideFlags){
					},
					priority:0,
				},
				'sardakkFlagship': {
					
					timing: 'beforeCombat_',
					
					condition: function(fleet,opponentFleet, battleSide, battleType,thisSideResources, thisSideFlags, unit, thisSideOptions ){
						return !unit.notInSystem;
					},
					effect: function(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, otherSideFlags, options, activeUnit, state, accumulation){
						

						const flag = {
							name: 'sardakkFlagship',
							shortType: 'SNF',
							duration: -1,
							unitPointer: null,
							side: battleSide,
						};
						
						thisSideFlags.push(flag);
						activeUnit.flagPointers.push(flag);

						flag.unitPointer = activeUnit;
					},
					deathEffect: function(deadUnit, fleet, opponentFleet, battleType, thisSideOptions, otherSideOptions, thisSideFlags, otherSideFlags){
					},
					priority:0,
				},
				'nomadMech': {
					
					timing: 'duringCombat',
					
					condition: function(fleet,opponentFleet, battleSide, battleType,thisSideResources, thisSideFlags, unit, thisSideOptions ){

						

						return !unit.notInSystem && unit.spaceArea && fleet.some(obj => obj.typeShip) && !unit.damaged && unit.sustainDamage && !unit.lostSustain && !unit.notUseSustain && !unit.isDamageGhost;


					},
					effect: function(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, otherSideFlags, options, activeUnit, state, accumulation){

						const sustain = activeUnit.toDamageGhost();
						// sustain.abilities.push('nomadMech');
						sustain.update({cancelHit:true, damageCorporeal:undefined});

						const flag = {
								name: 'nomadMech',
								shortType: 'NOM',
								duration: -1,
								unitPointer: null,
								side: battleSide,
							};
						sustain.flagPointers.push(flag);
						if (addUnit(fleet, sustain, battleType, thisSideFlags, options[battleSide])){
							

							thisSideFlags.push(flag);
							
							flag.unitPointer = sustain;
							
						}

						activeUnit.flagPointers.push(flag);

						

						
						
					},
					deathEffect: function(deadUnit, fleet, opponentFleet, battleType, thisSideOptions, otherSideOptions, thisSideFlags, otherSideFlags){
					
					},
					priority:0,
				},
				
			};
		}

		function initPassiveContinuousAbilities(){
			return [
				{
					name: 'mini',
					timing: 'beforeCombat_',
					condition: function(thisSideOptions ){

						return thisSideOptions.abilities.mini;
					},
					newUnitEffect: function(unit){
						
						
						if (unit.typeStructure && unit.spaceArea){
							unit.update({notUseUnitAbilities: true});
						}

						
						

						return true;
					
					},
					priority: -1,
				},
				{
					name: 'entropicScar',
					timing: 'beforeCombat_',
					condition: function(thisSideOptions ){

						return thisSideOptions.entropicScar;
					},
					newUnitEffect: function(unit){
						
						
						
						unit.update({notUseUnitAbilities: true});
						

						
						

						return true;
					
					},
					priority: -1,
				}
			]
		}

		function initActivations(){

			return [
				// {
				// 	name: 'mini',
				// 	timing: 'beforeCombat_',
				// 	condition: function(fleet,opponentFleet, battleSide, battleType,thisSideResources, thisSideFlags, thisSideOptions){
						
				// 		return (thisSideResources.moraleBoost) && (thisSideResources.moraleBoost.total > 0) && !(thisSideFlags.some(item => item.name === 'moraleBoost'));
				// 	},
				// 	effect: function(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, otherSideFlags, options){
				// 		thisSideResources.moraleBoost.total = Math.max(thisSideResources.moraleBoost.total-1,0);
				// 		thisSideFlags.push({
				// 			name: 'moraleBoost',
				// 			shortType: 'MB',
				// 			duration: 1,
				// 		})
				// 	},
				// 	priority: -1,
				// },

				{
					name: 'moraleBoost',
					timing: 'startOfRound',
					condition: function(fleet,opponentFleet, battleSide, battleType,thisSideResources, thisSideFlags, thisSideOptions){
						
						return (thisSideResources.moraleBoost) && (thisSideResources.moraleBoost.total > 0) && !(thisSideFlags.some(item => item.name === 'moraleBoost'));
					},
					effect: function(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, otherSideFlags, options){
						thisSideResources.moraleBoost.total = Math.max(thisSideResources.moraleBoost.total-1,0);
						thisSideFlags.push({
							name: 'moraleBoost',
							shortType: 'MB',
							duration: 1,
						})
					},
					priority: -1,
				},
				{
					name:'ambush',
					timing: 'startOfCombat',
					condition: function(fleet,opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, thisSideOptions){
						return (battleType === 'Space') && (thisSideOptions.abilities.ambush)  && !(thisSideFlags.some(item => item.name === this.name));
					},
					effect: function(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, otherSideFlags, options, unit, state, accumulation){

						
						
						var thisSideOptions = options[battleSide];

						var flagsToAdd = {attacker:undefined, defender:undefined};

						flagsToAdd[battleSide] = {
							name: 'ambush',
							shortType: 'AM',
							duration: -1,
						};

						function createMentakTransitions(fleetIn) {
							

							var units=[];
							var expected = [];
							for (var i = 0; i < fleetIn.length; i++) {
								const unit = fleetIn[i];
								if (unit.type === game.UnitType.Cruiser || unit.type === game.UnitType.Destroyer){

									const fakeUnit = unitToFakeUnit(unit, game.ThrowType.Battle, false, 0, 0, 0, false, thisSideOptions, true);
									const prob3D = exact([fakeUnit], false, false, 0);

									const expectedTotalHits = prob3D.reduce(
											(sum, row, hn) =>
												sum + row.reduce(
												(inner, col, hs) =>
													inner + col.reduce((inner2, p, s) => inner2 + p * (hn + hs), 0),
												0
												),
											0
									);
									expected.push(expectedTotalHits);
									units.push(unit);
								}
							}
							
							if (units.length === 0) return [[[1]], [[0]]]
							
							

							
							const indices = expected.map((_, i) => i)
										.sort((a, b) => expected[b] - expected[a])
										.slice(0, 2);

							
							

							const outputIn = computeFleetTransitionsWrapper(
								indices.map(i => units[i]),
								opponentFleet,
								battleSide,
								battleType,
								thisSideResources,
								game.ThrowType.Battle,
								thisSideFlags,
								thisSideOptions,
								true,
							)

							





							return outputIn;
							// return [[[1]], [[0]]];
							

							
							


							


						}

						if (battleSide === 'attacker') {
							var attackerTransitions3D=createMentakTransitions(fleet, options[battleSide]);
							
							var defenderTransitions3D = [[[1]]];

						} else {

							var attackerTransitions3D=createMentakTransitions(fleet, options[battleSide]);
							
							var defenderTransitions3D = [[[1]]];

						}

						
						
						

						const output = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, accumulation, undefined, battleType,  options, 0);

						

						
						

						return output;
					},
					priority: 1,
				},

				// yinIndoctrination: {
				// 	timing: 'startOfCombat',
				// 	condition: function(fleet, opponentFleet, battleType, thisSideResources, thisSideOptions){
				// 		var condition1 = thisSideOptions.abilities.indoctrination;
				// 		var condition2 = false;
				// 		//var condition2 = opponentFleet has 2 or more ground forces and isn't the Yin;
				// 		return condition1 || condition2;
				// 	},
				// 	effect: function(fleet, opponentFleet, resources, flags){
				// 		// remove 1 of your opponents infantry
				// 		// add 1 of your infantry
				// 	},
				// 	priority: 1,
				// }
			]
			
		}

		function initActiveBoosts(){

			return {

				'moraleBoost': {
					apply: function (unit, battleType, throwType, sideOptions) {
						const output = (throwType === game.ThrowType.Battle) ? 1 : 0;
						return output;
							
					}
				},
				'sardakkFlagship': {
					apply: function (unit, battleType, throwType, sideOptions) {
						const output = 
							function (unitIn) {
								return (throwType === game.ThrowType.Battle) && (unitIn !== unit) ? 1 : 0;
							};
						return output;
					}
				},

			}
		}
		function initPassiveBoosts(){
			return [
				{
					name: 'unrelenting',
					condition: function(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, thisSideOptions){
						return thisSideOptions.faction === game.Faction.Sardakk;
					},
					apply: function (battleType, throwType, sideOptions) {
						const output = (throwType === game.ThrowType.Battle) ? 1 : 0;
						return output;
							
					}

					
				}
			]
		}

		function initActiveRollBoosts(){

			return {

				

			}
		}
		function initPassiveRollBoosts(){
			return [
				{
					name: 'plasmaScoring',
					singleUnit: true,
					condition: function(fleet, opponentFleet, battleSide, battleType, thisSideResources, thisSideFlags, thisSideOptions){
						// return true;
						// return (fleet.filter(unit => unit.type !== undefined).length >= 1);
						// return (thisSideOptions.plasmaScoring);
						return (fleet.filter(unit => unit.type !== undefined).length >= 1) && (thisSideOptions.plasmaScoring);
					},
					apply: function (battleType, throwType, sideOptions) {
						
						const output = 
							function (unitIn) {
								return (unitIn.type !== undefined) && (throwType === game.ThrowType.Bombardment || throwType === game.ThrowType.SpaceCannon) ? 1 : 0;
							};
						return output;
					},
					 

					
				}

			]
		}
		function initActiveRerolls(){

			return {

				

			}
		}

		function initPassiveRerolls(){

			return [

				

			]
		}


		function initCancelHits(){
			return [
				{
					name: 'shieldsHolding',
					timing: 'duringCombat_',
					condition: function(fleet, hits, simRemaining, thisSideLost, thisSideResources, throwType, battleType, onceSet){
						return (thisSideResources.shieldsHolding) && (thisSideResources.shieldsHolding.total > 0) && hits > 1 && (simRemaining === 0|| thisSideLost) && battleType === 'Space' && !onceSet.has(this.name);
					},
					effect: function( fleet, thisSideResources){
						thisSideResources.shieldsHolding --;
						return [2,0]; // how many cancelled hits, and how many produced hits
					},
					priority: 1,
				},
				{
					name: 'nomadMech',
					timing: 'duringCombat_',
					condition: function(fleet, hits, simRemaining, thisSideLost, thisSideResources, thisSideFlags, throwType, battleType){
						return thisSideFlags.some(item => item.name === this.name) && hits > 0 && (simRemaining === 0 || thisSideLost) && fleet.some(unit => unit.typeShip);
					},
					effect: function( fleet, thisSideResources, otherSideResources, thisSideFlags, timing, thisSideOptions, thisSideAccumulation){
						const flagIndex = thisSideFlags.findIndex(obj => obj.name === this.name);

						const [flag] = thisSideFlags.splice(flagIndex,1);
						const unit = flag.unitPointer;

						fleet.splice(fleet.indexOf(unit),1);

						
						return sustainDamageEffect(unit, fleet, thisSideResources, otherSideResources, timing, thisSideOptions, thisSideAccumulation);
					},
					priority: 1,
				}

					
			]
			
		}

		function rollBoost(battleType, thisSideOptions, opponentSideOptions, fleet, firstRound,fleetFull) {
			var result = undefined;
			for (var i = 0; i < rollBoosts.length; i++) {
				if (!firstRound && rollBoosts[i].firstRoundOnly) continue;

				var boost = rollBoosts[i].apply(battleType, thisSideOptions, opponentSideOptions, fleet,fleetFull);
				if (boost && !result) {
					result = boost;
					continue;
				}
				if (boost) {
					result = compose(result, boost);
				}
			}
			//console.trace();
			return result;

			function compose(boost1, boost2) {
				var boost1IsFunction = typeof boost1 === 'function';
				var boost2IsFunction = typeof boost2 === 'function';
				if (boost1IsFunction || boost2IsFunction) {
					return function (unit) {
						return (boost1IsFunction ? boost1(unit) : boost1) +
							(boost2IsFunction ? boost2(unit) : boost2);
					};
				}
				else {
					return boost1 + boost2;
				}
			}
		}
		function initExtraRolls() {
			return [
				// {
				// 	name: 'NaazRokhaFlagshipMechs',
				// 	firstRoundOnly: false,
				// 	apply: function (battleType, sideOptions, opponentOptions, fleet,fleetFull) {
				// 		return (sideOptions.faction === game.Faction.NaazRokha  &&
				// 		fleetFull.some(unitIs(game.UnitType.Flagship))) ?
				// 			function (unit) {	
				// 				return unit.type === game.UnitType.Mech ? 1 : 0;
				// 			} : 0;
				// 	}
				// },
				// {
				// 	name: 'baronyAgent',
				// 	firstRoundOnly: true,
				// 	apply: function (battleType, sideOptions, opponentOptions, fleet) {
				// 		return (sideOptions.letnevAgent && battleType === game.BattleType.Space) ?
				// 			function (unit) {
				// 				return unit === getUnitWithLowest(fleet, game.ThrowValues[game.ThrowType.Battle]) ? 1 : 0;
				// 			} : 0;
				// 	}
				// },
				// {
				// 	name: 'FederationAgent',
				// 	firstRoundOnly: true,
				// 	apply: function (battleType, sideOptions, opponentOptions, fleet, fleetFull) {
				// 		return (sideOptions.solAgent && battleType === game.BattleType.Ground) ?
				// 			function (unit) {
				// 				return unit === getUnitWithLowest(fleet, game.ThrowValues[game.ThrowType.Battle]) ? 1 : 0;
				// 			} : 0;
				// 	}
				// },
			]
		}
		
		function fleetTransitionsVector(fleet, throwType, modifier, modifierRoll, reroll, mySideOptions) {
			var vector = computeFleetTransitions(fleet, throwType, modifier, modifierRoll, reroll, mySideOptions).pop();
			if (mySideOptions.plasmaScoringC && ((throwType==game.ThrowType.Bombardment && !(fleet.initialBombardment && mySideOptions.plasmaScoringFirstRound)) || throwType==game.ThrowType.SpaceCannon) && vector.length>1){
				vector=listCoords(vector.transitions,throwType, modifier, modifierRoll);
			}
			return vector;
		}
		function listCoords(dimensions,throwType, modifier, modifierRoll) {
			var cumulatives = new Array(dimensions.length);
			var total = 1;
			var altTotal=0;
			modifierRoll = modifierRoll || 0;
			var modifierFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifier === 'function' ? modifier(unit) : modifier;
			};
			var modifierRollFunction = function (unit) {
				return unit.isDamageGhost ? 0 : typeof modifierRoll === 'function' ? modifierRoll(unit) : modifierRoll;
			};
			for (var d = dimensions.length - 1; d >= 0; d--) {
				cumulatives[d] = total;
				total *= dimensions[d].length;
				altTotal+=dimensions[d].length;
			}
			var coords = new Array(altTotal-dimensions.length+1).fill(0);
			for (var i = 0; i < total; i++) {
				var prob=1;
				var hits=0;
				var misses=0;
				for (var d = dimensions.length - 1; d >= 0; d--) {
					var index=Math.floor(i / cumulatives[d]) % dimensions[d].length
					prob *= dimensions[d][index];
					hits+=index;
					var unit=dimensions[d].unit;
					misses+=unit[game.ThrowDice[throwType]]+modifierRollFunction(unit)>index && 10+modifierFunction(unit)>=unit[game.ThrowValues[throwType]];
				}
				if (misses>0)
					hits+=1;
				coords[hits] += prob;
			}
			return coords;
		}
		
		
		

		function getUnitWithLowest(fleet, property) {
			var result = null;
			var bestBattleValue = Infinity;
			for (var i = 0; i < fleet.length; i++) {
				if (fleet[i][property] < bestBattleValue && !fleet[i].isDamageGhost && (fleet[i].type !== game.UnitType.Planet)) {
					result = fleet[i];
					bestBattleValue = fleet[i][property];
				}
			}
			return result;
		}
		// function cancelHits(transitionsVector, cancelledHits, cancelFrom) {
		// 	cancelFrom = cancelFrom || 0;
		// 	for (var c = 0; c < cancelledHits; ++c) {
		// 		if (transitionsVector.length > cancelFrom + 1)
		// 			transitionsVector[cancelFrom] += transitionsVector[cancelFrom + 1];
		// 		for (var i = cancelFrom + 2; i < transitionsVector.length; i++)
		// 			transitionsVector[i - 1] = transitionsVector[i];
		// 		if (transitionsVector.length > cancelFrom + 1)
		// 			transitionsVector.pop();
		// 	}
		// 	return transitionsVector;
		// }
		
		


		// function print(obj) {
		// 	// Get the current stack trace to find the line where the function is called
		// 	const stack = new Error().stack;
		// 	const stackLines = stack.split("\n");
		  
		// 	// Get the line number from the stack trace
		// 	const match = stackLines[1].match(/(?:\()?(.*):(\d+):\d+\)?$/);
  		// 	const fileName = match ? match[1].split('/').pop() : 'unknown';
		// 	const lineNumber = match ? match[2] : 'unknown';
		  
		// 	// Check if the object is undefined or null and print accordingly
		// 	if (obj === undefined || obj === null) {
		// 	  	console.log(`${obj} at ${fileName}:${lineNumber}`);
		// 	} else {
		// 	  	// If the object is neither null nor undefined, print a copy of the object
		// 		console.log(JSON.parse(JSON.stringify(obj)), `at ${fileName}:${lineNumber}`);
		// 	}
		// }

		function print(obj) {
			// --- stack trace extraction ---
			const stack = new Error().stack || '';
			const stackLines = stack.split('\n');
			const callerLine = stackLines[1] || stackLines[2] || '';
			const match = callerLine.match(/(?:\()?(.*):(\d+):\d+\)?$/);
			const fileName = match ? match[1].split('/').pop() : 'unknown';
			const lineNumber = match ? match[2] : 'unknown';

			// Map to store first-seen paths for objects (canonical reference)
			const firstPath = new WeakMap();

			// Generate a friendly label for a given object
			function friendlyLabel(obj, index) {
				if (obj && typeof obj === 'object') {
				if ('name' in obj) return `${obj.name}[${index}]`;
				if ('type' in obj) return `${obj.type}[${index}]`;
				}
				return `[${index}]`;
			}

			// Copy object recursively, replacing cycles on the current chain only
			function copyWithCycleHandling(value, path, ancestors, parentIndex) {
				if (value === null || typeof value !== 'object') return value;

				// Detect circular reference on this ancestor chain
				for (let i = ancestors.length - 1; i >= 0; i--) {
				if (ancestors[i].obj === value) {
					const canonical = firstPath.get(value) || path;
					return `[Circular -> ${canonical}]`;
				}
				}

				// Record first-seen path for friendly markers
				if (!firstPath.has(value)) {
				firstPath.set(value, path);
				}

				ancestors.push({ obj: value, index: parentIndex });

				let out;
				if (Array.isArray(value)) {
				out = [];
				for (let i = 0; i < value.length; i++) {
					const label = friendlyLabel(value[i], i);
					const childPath = `${label}`;
					out[i] = copyWithCycleHandling(value[i], childPath, ancestors, i);
				}
				} else {
				out = {};
				for (const k of Object.keys(value)) {
					const child = value[k];
					const keyPath = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)
					? `${path}.${k}`
					: `${path}[${JSON.stringify(k)}]`;
					out[k] = copyWithCycleHandling(child, keyPath, ancestors, k);
				}
				}

				ancestors.pop();
				return out;
			}

			if (obj === undefined || obj === null) {
				console.log(`${obj} at ${fileName}:${lineNumber}`);
			} else {
				try {
				const copy = copyWithCycleHandling(obj, '', [], 0);
				console.log(copy, `at ${fileName}:${lineNumber}`);
				} catch (e) {
				console.log('[Unserializable object] at', `${fileName}:${lineNumber}`, e);
				}
			}
		}





		
		



		function incr(obj,num){
			if (obj === undefined || obj === null){
				obj=0;
			}
			return obj+=num;
		}
		function unitIsAndGhost(unitType) {
			return function (unit) {
				return unit.type === unitType && unit.isDamageGhost;
			};
		}
		function unitGhost(unit){
			return unit.isDamageGhost;
		}
		// function unitShield(disable) {
		// 	return function (unit) {
		// 		return unit.planetaryShield && !unit.isDamageGhost && (!disable || (disable && unit.type !== game.UnitType.PDS));
		// 	};
		// }
		function unitOnPlanetWithSpaceCannon(unit) {
			return unit.spaceCannonDice !== 0 && !unit.typeShip;
		}
		function True(){
			return function (){
				return true;
			}
		}
		function False(){
			return function (){
				return false;
			}
		}
		function getKeyByValue(object, value) { 
			return Object.keys(object).find(key => object[key] === value); 
		}	

		function notFighterShipNorGhost(combat){
			return function (unit) {
				return notFighterShip(combat)(unit) && !unit.isDamageGhost;
			}
		}
		function ship(combat){
			return function (unit) {
				return unit.typeShip && validUnit(combat)(unit);
			}
		}
		function notFighterShip(combat){
			return function (unit) {
				return unit.type !== game.UnitType.Fighter && unit.typeShip && validUnit(combat)(unit);
			}
		}
		function validUnit(combat) {
			return function (unit) {
				return  combat || !unit.typeGroundForce;
			}
		}

		function groundForce(unit) {
			return unit.typeGroundForce && !unit.isDamageGhost;
		}
		function structure(unit) {
			return unit.typeStructure && !unit.isDamageGhost;
		}

		function notFighterNorGroundForceShip(unit) {
			return unit.type !== game.UnitType.Fighter && !unit.typeGroundForce && !unit.isDamageGhost;
		}
		
		function hasBarrage(unit) {
			return unit.barrageDice !== 0;
		}

		


		function findLastIndex(array, predicate) {
			for (var i = array.length - 1; 0 <= i; --i) {
				if (predicate(array[i]))
					return i;
			}
			return -1;
		}
		function sum(a, b) {
			return a + b;
		}
		function sumColumn(array,index){
			var result = 0;
			for (var i=0; i<array.length; i++){
				result += array[i][index] || 0;
			}
			return result;
		}
		function sumRow(array,index){
			var result = array[index] || [0];
			return result.reduce(sum,0);
		}
		function sumArray(array){
			var result = 0;
			for (var i=0; i<array.length; i++){
				for (var j=0; j<array[i].length; j++){
					result += array[i][j] || 0;
				}
			}
			return result;
		}
		function removeRow(array,index){
			if (index === Infinity) return;
			array.splice(index,1);
		}
		function removeColumn(array,index){
			if (index === Infinity) return;
			for (var i=0; i<array.length; i++){
				array[i].splice(index,1);
			}
		}
		function addColumn(array, columns,position) {
			for (var j = 0; j < columns.length; j++) {
				var row = columns[j];
				for (var i = row.length-1; i>=0; i--) {
					array[j].splice(position, 0, row[i]);
				}
			}
		}

		
		
	})();
})(typeof exports === 'undefined' ? window : exports);