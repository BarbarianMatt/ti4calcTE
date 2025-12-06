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
		var deathEffects = initDeathEffects();


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


		const timingsOrder = ['beforeEverything','spaceCannonOffense', 'bombardment', 'spaceCannonDefense', 'beforeCombat','duringCombat', 'startOfCombat',  'barrage', 'announceRetreat',  'combatRolls', 'retreat', 'endOfRound', 'cleanup'];

		const unitKeys = Object.keys(new root.UnitInfo(UnitType.WarSun, {})).slice();
		unitKeys.sort();
		// var prebattleActions = initPrebattleActions();

		
		var everRetreat = false;

		var cache = cache || {};
		cache.variantsByShortType = cache.variantsByShortType || new Map(); // shortType -> Map(sig -> variantIndex)
		cache.nextVariantIndex = cache.nextVariantIndex || new Map();      // shortType -> nextIndex


		

		// property name used on unit objects
		const LABEL_PROP = 'label'; // e.g. "D0"

		// Build a stable signature for a unit (exclude shortType)
		function stableUnitSignature(unit) {
			// build keys sorted, skipping 'shortType'
			
			const parts = [];
			for (let i = 0; i < unitKeys.length; i++) {
				const k = unitKeys[i];
				if (k === 'shortType' || k === 'ghostCorporeal' || k === 'damageCorporeal' || k === 'flagPointers' || k === '_baseStats' ||  k === LABEL_PROP) continue;
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
			for (let i = 0; i < arr.length; i++) 
				out += arr[i].shortType + String(arr[i].total);
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

		function appendPolesSimple(flagsObj) {
			const arr = Object.values(flagsObj || {});
			if (arr.length === 0) return '';
			arr.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
			let out = '';
			for (let i = 0; i < arr.length; i++) {
				const f = arr[i];
				if (f === 'skip') continue;
				out += f + '_';
			}
			return out;
		}

		// main function (mutating + signature-based lookup when unlabeled)
		function buildStateKey(attackerState, defenderState, resourcesState, flagsState, polesState) {
			const aLabel = sideToLabelString(attackerState || []) + '-';
			const dLabel = sideToLabelString(defenderState || []) + '-';

			const aRes = appendResourcesSimple(resourcesState && resourcesState.attacker);
			const dRes = appendResourcesSimple(resourcesState && resourcesState.defender);

			const aFlags = appendFlagsSimple(flagsState && flagsState.attacker);
			const dFlags = appendFlagsSimple(flagsState && flagsState.defender);

			const aPoles = appendPolesSimple(polesState && polesState.attacker);
			const dPoles = appendPolesSimple(polesState && polesState.defender);

			return aLabel + aRes + aFlags + aPoles + '|' + dLabel + dRes + dFlags + dPoles;
		}

		cache.labelTransformations = cache.labelTransformations || new Map();

		/**
		 * Build a stable signature for the *changes* object (sorted keys, arrays sorted).
		 * Mirrors stableUnitSignature but tailored for changes object.
		 */
		function stableChangesSignature(changes) {
			if (!changes || typeof changes !== 'object') return String(changes);
			
			
			let s = '';
			for (let i = 0; i < unitKeys.length; i++) {
				const k = unitKeys[i];
				if (k in changes) { // check existence
					const v = changes[k];
					s += k;
					s += '=';
					s += (v === undefined || v === null) ? String(v) : String(v);
					s += '|';
				}
			}
			
			return s;
		}

		/**
		 * Ensure the top-level transformation map exists for a shortType
		 */
		function ensureTransformationMapsFor(shortType) {
			if (!cache.labelTransformations.has(shortType)) {
				cache.labelTransformations.set(shortType, new Map());
			}
		}

		

		
		function printCache() {
    // ===== variantsByShortType =====
    if (cache.variantsByShortType) {
        console.log('=== cache.variantsByShortType ===');

        cache.variantsByShortType.forEach((variantMap, shortType) => {
            if (!variantMap) return;

            const variants = [...variantMap.entries()].sort((a, b) => a[1] - b[1]);
            if (variants.length === 0) return;

            // Build a map of property -> set of all values across variants
            const propValuesMap = {}; // key -> Set of values
            variants.forEach(([sig]) => {
                sig.split('|').filter(p => p).forEach(part => {
                    const [key, value] = part.split('=');
                    if (!propValuesMap[key]) propValuesMap[key] = new Set();
                    propValuesMap[key].add(value);
                });
            });

            console.log(`--- ShortType: ${shortType} ---`);

            variants.forEach(([sig, index]) => {
                const parts = sig.split('|').filter(p => p);
                let logStr = '';
                const logArgs = [];

                parts.forEach((part, i) => {
                    const [key, value] = part.split('=');
                    if (i > 0) {
						logStr += '%c|';
						logArgs.push('color: black');
					}

                    // If the property has multiple values across variants, color it
                    if (propValuesMap[key].size > 1) {
                        logStr += `%c${key}=${value}`;
                        logArgs.push('color: red; font-weight: bold');
                    } else {
                        logStr += `%c${key}=${value}`;
                        logArgs.push('color: black');
                    }
                });

                console.log(`Index ${index}: ` + logStr, ...logArgs);
            });
        });
    } else {
        console.log('No variantsByShortType found.');
    }

    // // ===== nextVariantIndex =====
    // if (cache.nextVariantIndex) {
    //     console.log('=== cache.nextVariantIndex ===');
    //     cache.nextVariantIndex.forEach((nextIndex, shortType) => {
    //         console.log(`ShortType: ${shortType} -> NextIndex: ${nextIndex}`);
    //     });
    // }

    // ===== labelTransformations =====
    // if (cache.labelTransformations) {
    //     console.log('=== cache.labelTransformations ===');
    //     cache.labelTransformations.forEach((perShort, shortType) => {
    //         console.log(`--- ShortType: ${shortType} ---`);
    //         perShort.forEach((perOld, oldLabel) => {
    //             console.log(`OldLabel: ${oldLabel}`);
    //             perOld.forEach((newLabel, changeSig) => {
    //                 console.log(`  ChangeSig: ${changeSig} -> NewLabel: ${newLabel}`);
    //             });
    //         });
    //     });
    // }
}



		(function wrapUnitInfoUpdate() {

			
			// Only wrap once
			if (!UnitInfo || !UnitInfo.prototype) return;

			if (UnitInfo.prototype.__updateWrappedByLabelCache) return;
			UnitInfo.prototype.__updateWrappedByLabelCache = true;

			const originalUpdate = UnitInfo.prototype.update;

			UnitInfo.prototype.update = function (changes) {
				// capture old label and shortType
				const oldLabel = this.label; // may be undefined
				const shortType = this.shortType;

				

				// compute a stable signature for the changes (used as map key)
				const changeSig = stableChangesSignature(changes);
				

				// call original update (it will assign changes and set this.label = undefined)
				originalUpdate.call(this, changes);

				// If we don't have a shortType string, fall back to computing label normally
				if (typeof shortType !== 'string') {
					// defensive: compute label normally (labelForUnit_withSig will validate shortType)
					labelForUnit_withSig(this);
					return;
				}

				// Fast-path: if we had an oldLabel and we already cached a mapping for (oldLabel, changeSig)
				if (typeof oldLabel === 'string') {
					
					ensureTransformationMapsFor(shortType);

					const perShort = cache.labelTransformations.get(shortType);
					let perOld = perShort.get(oldLabel);
					if (perOld && perOld.has(changeSig)) {
						// apply cached new label
						const mappedNewLabel = perOld.get(changeSig);
						// attach to unit
						this.label = mappedNewLabel;
						
						return;
					}
				}

				// Otherwise compute new label and store the mapping if we had an oldLabel
				const newLabel = labelForUnit_withSig(this); // will compute & attach label

				if (typeof oldLabel === 'string') {
					ensureTransformationMapsFor(shortType);
					const perShort = cache.labelTransformations.get(shortType);
					let perOld = perShort.get(oldLabel);
					if (!perOld) {
						perOld = new Map();
						perShort.set(oldLabel, perOld);
					}
					perOld.set(changeSig, newLabel);
				}

				// done
			};
		})();



		return {
			computeProbabilities: computeProbabilities,
			// fleetTransitionsVector: fleetTransitionsVector,
		};

		/** Compute survival probabilities of each subset of attacker and defender */
		function computeProbabilities(input) {
			var battleType = input.battleType;
			var options = structuredClone(input.options) || { attacker: {}, defender: {} };
			options.attacker.unitCounters = input.units.attacker;
			options.defender.unitCounters = input.units.defender;
			options.attacker.unitsCanon = input.unitsCanon.attacker;
			options.defender.unitsCanon = input.unitsCanon.defender;
			options.attacker.unitsVersion = input.unitsVersion.attacker;
			options.defender.unitsVersion = input.unitsVersion.defender;



			
			





			
			// console.trace();
			
			// var finalDistribution;
			// var finalAttacker;
			// var finalDefender;
			var [[finalDistribution, finalAttacker, finalDefender], [finalDistributionSurvived, finalAttackerSurvived, finalDefenderSurvived], finalAccumulations]=  propagateProbabilityAllDirections_hashtable(battleType,options,input);

			

			

			return [{
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
			},
			{
				distribution: finalDistributionSurvived,
				attacker: finalAttackerSurvived.map(function (set) {
					return set.reduce(function (prev, item) {
						return prev + item;
					});
				}),
				defender: finalDefenderSurvived.map(function (set) {
					return set.reduce(function (prev, item) {
						return prev + item;
					});
				}),
				accumulations: finalAccumulations,
			},
		
		
		
			];

			
		}

		function unitAbility(throwType){
			return throwType === game.ThrowType.Barrage || throwType === game.ThrowType.Bombardment || throwType === game.ThrowType.SpaceCannon;
		}

		function nonFighterShip(unit){
			return unit.typeShip && unit.type !== game.UnitType.Fighter;
		}

		function fleetLength(fleet){
			return fleet.filter(unit => unit.type !== undefined && !unit.isDamageGhost && !unit.immune && !unit.invisible).length;
		}


		

		

		function makeSustainHardPredicate(deadSim, oldHardPredicate, thisSideOptions) {
			// Collect all types of "damage ghost" units
			const ghostTypes = new Set(
				deadSim
				.filter(unit => unit.isDamageGhost)
				.map(unit => unit.type)
			);

			// Return the predicate function
			return function hardPredicate(unit) {
				const oldHard = unit.isDamageGhost && !unit.alreadySustained && unit.damageCorporeal ? oldHardPredicate(unit.damageCorporeal) && oldHardPredicate(unit) : oldHardPredicate(unit);
				return (ghostTypes.has(unit.type) || ((!unit.sustainDamage || unit.lostSustain) && nonFighterShip(unit) && thisSideOptions.voidShielding)) && oldHard;
			};
		}


				

		function fastShallowCloneUnit(unit) {
			// create a new object with the same prototype (so methods exist)
			const newUnit = Object.create(Object.getPrototypeOf(unit));
			
			Object.assign(newUnit, unit);
			
			newUnit.damageCorporeal=undefined;
			newUnit.ghostCorporeal=undefined;
			newUnit.flagPointers=[];
			delete newUnit._baseStats;

			// this line might be necessary for the future, but for now text abilities of units don't change so its fine to keep a reference instead of copying it.
			newUnit.abilities = [...unit.abilities];
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

			
			const newFlags = flagsClone(flags);
			
			

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
			
			assignFlags(flags.attacker, newFlags.attacker);
			assignFlags(flags.defender, newFlags.defender)

			
			return [newFleetA, newFleetD, newFlags];

			function assignFlags(oldFlgs, newFlgs){
				for (let i = 0; i < newFlgs.length; i++){
					const newFlag = newFlgs[i];
					const flag = oldFlgs[i];
					
					if (flag.unitPointer){
						if (flag.unitSide === game.BattleSide.attacker){
							const idx = indexByUnitA.get(flag.unitPointer);
							if (idx !== -1)
								newFlag.unitPointer = newFleetA[idx]
						} else {
							const idx = indexByUnitD.get(flag.unitPointer);
							if (idx !== -1)
								newFlag.unitPointer = newFleetD[idx]
						}
					}
				}
			}

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
							// newFlags.attacker[idxFlag].unitPointer = newUnit;
						}
					}
					if (indicesD.length > 0){
						for (var idxFlag of indicesD){
							newUnit.flagPointers.push(newFlags.defender[idxFlag]);
							// newFlags.defender[idxFlag].unitPointer = newUnit;
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

		function duraniumArmorRepair(battleSide, battleType, state, accumulation, options) {
			for (var i = 0; i < state[battleSide].length; i++) {
				var unit = state[battleSide][i];

				if (unit.damaged && !unit.sustainedThisRound && !unit.invisible) {
					// print('trigger');

					unit.update({damaged: false});

					if (unit.sustainDamage && !unit.lostSustain && !unit.notUseSustain){
						const sustain = unit.toDamageGhost()
						addUnit(state[battleSide], sustain, battleSide, battleType,  state, accumulation, options);
					}
					
					return true;
				}
			}
			return false;
		}

		

		function applyContinuousEffectsOnUnits(units, battleSide, battleType,  state, accumulation, options){

			

			var effects = []
			for (const flag of state.flags[battleSide]){
				
				if (flag.newUnitEffect !== undefined){
					effects.push(flag)
				}
			}
			for (const passive of passiveContinuousAbilities){
				if 	(
					passive.newUnitEffect !== undefined &&
					checkTiming(state.timing, passive.timing) && 
					passive.condition(battleSide, battleType,  state, accumulation, options) ) {
						effects.push(passive)
					}
			}
			


			effects = effects.sort((a,b) => b.priority - a.priority);
			
			

			

			for (var i = units.length-1; i >= 0; i--) {
				const unit = units[i];
				
				for (const effect of effects){
					
					if (!effect.newUnitEffect(unit, battleSide, battleType,  state, accumulation, options)){
						units.splice(i,1);
						break;
					}
				}
				
			}

			return units

			
		}

		function replaceUnit(fleet, unitType, battleSide, battleType,  state, accumulation, options){

			var onlyAdd = false;

			
			
			const newBaseStats = game.createUnit(unitType, 1, [], battleType, options[battleSide].unitsCanon, options[battleSide], state.poles[battleSide])[0]._baseStats;
			const baseStatsOG = options[battleSide].unitsCanon[unitType].clone()._baseStats;

			

			// print(newBaseStats)
			// print(baseStatsOG);
			// print( options[battleSide].unitsCanon[unitType]);

			for (const unit of fleet){
				

				if (unit.type === unitType && !unit.isDamageGhost){
					
					 
					const baseStats = {};
					
					
					for (const key in unit) {
						if (baseStatsOG.hasOwnProperty(key) && !newBaseStats.hasOwnProperty(key) && !onlyAdd){
							baseStats[key] = undefined;
						} else if (newBaseStats.hasOwnProperty(key) && !(baseStatsOG.hasOwnProperty(key) &&  baseStatsOG[key] === newBaseStats[key])){
							baseStats[key] = newBaseStats[key];
						}
					}
					
					var removeAbilities = (baseStatsOG.abilities || []).filter(obj => !(newBaseStats.abilities || []).includes(obj));
					var addAbilities = (newBaseStats.abilities || []).filter(obj => !(baseStatsOG.abilities || []).includes(obj) && !(unit.abilities.includes(obj)));

					baseStats.abilities = simpleListClone(unit.abilities);
					

					if (!onlyAdd){
						baseStats.abilities = unit.abilities.filter(obj => !removeAbilities.includes(obj));
					}

					// print(unit)

					baseStats.abilities.push(...addAbilities);

					if (options[battleSide].copy.titansPDSIICopy && unit.type === game.UnitType.PDS && unit.invisible && unit.immune && unit.passive){
						baseStats.invisible = false;
						baseStats.immune = false;
						baseStats.passive = false;
						
					}
					
					unit.update(baseStats);

					

					

					

					for (const abilityName of removeAbilities){

						const idx = unit.flagPointers.find(obj => obj.name === abilityName);
						if (idx !== -1){
							unit.flagPointers.splice(idx, 1);

							const ability = continuousUnitAbilities[flagPointer.name];
							if (ability && ability.terminate !== undefined) {
								ability.terminate(unit, battleSide, battleType, state, accumulation, options);
							}

							
						}

						
						
					}
					
					
					for (const abilityName of addAbilities){
						
						const ability = continuousUnitAbilities[abilityName];
						if (ability &&
							checkTiming(state.timing, ability.timing) &&
							ability.condition(unit, battleSide, battleType,  state, undefined, options)
						) {
							ability.effect(unit, battleSide, battleType,  state, undefined, options);
						}
					}
					
				}
			}
		
		
			game.fillOutFleet(fleet, battleType, options[battleSide]);

			

			

		}

		function addUnit(fleet, unit, battleSide, battleType,  state, accumulation, options, sort = true){

			var newUnit = applyContinuousEffectsOnUnits([unit], battleSide, battleType,  state, accumulation, options);



			if (newUnit.length === 0){ return false;}

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

			if (sort)
				game.fleetSort(state[battleSide], battleType, options[battleSide]);

			

			for (const abilityName of newUnit.abilities){
				const ability = continuousUnitAbilities[abilityName];
				if (ability &&
					checkTiming(state.timing, ability.timing) &&
					ability.condition(newUnit, battleSide, battleType,  state, accumulation, options,)
				) {
					ability.effect(newUnit, battleSide, battleType,  state, accumulation, options,);
				}
			}
			return true;
			
			
			

		}

		

		function createUnits(unitType, count, battleSide, battleType,  state, accumulation, options){





			
			
			
			
			
			const units = []
			
			game.createUnit(unitType, count, units, battleType, options[battleSide].unitsCanon, options[battleSide], state.poles[battleSide])
			
			
			
			
			for (const unit of units) {
				
				
				delete unit._baseStats;
				addUnit(state[battleSide], unit, battleSide, battleType,  state, accumulation, options, false);
				
				
			}
			

			game.fleetSort(state[battleSide], battleType, options[battleSide]);

			

			
			

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
		function accumulationClone(obj) {
			
			const out = {};
			out.attacker = simpleClone(obj.attacker);
			out.defender = simpleClone(obj.defender);
			out.rounds = obj.rounds;
			
			
			return out;
		}
		function resourcesClone(obj) {
			
			const out = {};
			out.attacker = simpleClone(obj.attacker);
			out.defender = simpleClone(obj.defender);
			
			
			return out;
		}

		

		function flagsClone(obj) {
			if (!obj) return obj;
			const out = {};
			// const out = [];
			for (const k in obj) {
				const arr = obj[k];
				// if (!Array.isArray(arr)) {
				// 	out[k] = arr; // primitive or non-array object
				// 	continue;
				// }
				// const n = arr.length;
				// const arrCopy = new Array(n);
				// for (let i = 0; i < n; i++) {
				// 	const el = arr[i];
					
				// 	if (el && typeof el === 'object') {
				// 		const cloned = { ...el };
				// 		for (const prop in el) {
				// 			if (prop === 'unitPointer') continue;
				// 			cloned[prop] = el[prop];
				// 		}
				// 		if ('unitPointer' in el) {
				// 			cloned.unitPointer = undefined;
				// 		}
				// 		arrCopy[i] = cloned;
				// 	} else {
				// 		arrCopy[i] = el;
				// 	}
					
				// }
				// out[k] = arrCopy;

				out[k] = simpleListClone(arr);
			}
			return out;
		}

		function simpleListClone(arr) { 
			if (!Array.isArray(arr)) {
				return arr;
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
			return arrCopy
		}

		

		function resolveDead2(state, deadUnitsAttacker, deadUnitsDefender, accumulation, battleType, options, {
			startKey=false,
			noDivinity = false,
		} = {}){

			var attackerSort = state.attacker.some(obj => obj.leaveEarly);
			var defenderSort = state.defender.some(obj => obj.leaveEarly);

			if (state.resources.attacker.divinity?.total > 0 && !noDivinity){

				
				game.fleetSort(deadUnitsAttacker, battleType, options.attacker);

				var count = 0
				for (var i = 0; i < deadUnitsAttacker.length && count < state.resources.attacker.divinity.total; i++){
					const unit = deadUnitsAttacker[i];
					if (!unit.isDamageGhost){
						state.attacker.push(deadUnitsAttacker.splice(i,1)[0]);
						i--;
						count++;
					}

				}
				
				attackerSort = true;
				state.resources.attacker.divinity.total -= count;
			}

			if (state.resources.defender.divinity?.total > 0 && !noDivinity){

				
				game.fleetSort(deadUnitsDefender, battleType, options.defender);
				
				var count = 0
				for (var i = 0; i < deadUnitsDefender.length && count < state.resources.defender.divinity.total; i++){
					const unit = deadUnitsDefender[i];
					if (!unit.isDamageGhost){
						state.defender.push(deadUnitsDefender.splice(i,1)[0]);
						i--;
						count++;
					}

				}
				
				defenderSort = true;
				state.resources.defender.divinity.total -= count;
			}
			


			if (deadUnitsAttacker.length > 0){
				for (var i = state.attacker.length-1; i>=0; i--){
					const unit = state.attacker[i];
					if (unit.isDamageGhost && unit.damageCorporeal && !state.attacker.includes(unit.damageCorporeal)){
						deadUnitsAttacker.push(state.attacker.splice(i,1)[0]);
					}
				}

				
			}
			if (attackerSort){
				game.fleetSort(state.attacker, battleType, options.attacker);
			}
			if (deadUnitsDefender.length > 0){

				for (var i = state.defender.length-1; i>=0; i--){
					const unit = state.defender[i];
					if (unit.isDamageGhost && unit.damageCorporeal && !state.defender.includes(unit.damageCorporeal)){
						deadUnitsDefender.push(state.defender.splice(i,1)[0]);
					}
				}
				
			}
			if (defenderSort){
				game.fleetSort(state.defender, battleType, options.defender);
			}
			
			

			var [attackerAbilities, defenderAbilities] = getDeathAbilities(deadUnitsAttacker, deadUnitsDefender, state, accumulation);

			// print(attackerAbilities)
			
			var sortFunction = (a, b) => b.priority - a.priority;

			var transitions = [];
			var newStates = [];
			var accumulations = [];

			var attackerDeadSim = [];
			var defenderDeadSim = [];

			const stateIndexMap = new Map();

			var stack = [];
			stack.push({
				state: state,
				attacker:{
					pass:false,
					abilities: attackerAbilities.sort(sortFunction),
					deadSim:[],
					// sorted: false,
				},
				defender: {
					pass: false,
					abilities: defenderAbilities.sort(sortFunction),
					deadSim: [],
					// sorted: false,
				},
				transition: 1,
				accumulation: accumulation,
			})

			for (const unit of deadUnitsAttacker){
				// stack[0].attacker.deadSim.push({
				// 	isDamageGhost: unit.isDamageGhost,
				// 	type: unit.type,
				// 	label: unit.label,
				// 	abilities: unit.abilities,
				// })
				stack[0].attacker.deadSim.push(unit);
			}
			for (const unit of deadUnitsDefender){
				// stack[0].defender.deadSim.push({
				// 	isDamageGhost: unit.isDamageGhost,
				// 	type: unit.type,
				// 	label: unit.label,
				// 	abilities: unit.abilities,
				// })
				stack[0].defender.deadSim.push(unit);
			}
			
			while (stack.length){
				const frame = stack.shift();
				
				while (!(frame.attacker.pass && frame.defender.pass)){

					oneSide(frame, game.BattleSide.attacker);

					if (frame.attacker.pass && frame.defender.pass) { break}

					oneSide(frame, game.BattleSide.defender);


				}

				

				if (startKey){

					frame.state.startKey = buildStateKey(frame.state.attacker, frame.state.defender, frame.state.resources, frame.state.flags, frame.state.poles)

					if (stateIndexMap.has(frame.state.startKey)) {
						const idx = stateIndexMap.get(frame.state.startKey);
						transitions[idx] += frame.transition;
									
					} else {
						const thisIndex = newStates.length;
						stateIndexMap.set(frame.state.startKey, thisIndex);


						transitions.push(frame.transition);
						newStates.push(frame.state);
						attackerDeadSim.push(frame.attacker.deadSim);
						defenderDeadSim.push(frame.defender.deadSim);
						accumulations.push(frame.accumulation);

						
					}
					
				} else {
					transitions.push(frame.transition);
					newStates.push(frame.state);
					attackerDeadSim.push(frame.attacker.deadSim);
					defenderDeadSim.push(frame.defender.deadSim);
					accumulations.push(frame.accumulation);
				}

				

				
			}

			return [transitions, newStates, [attackerDeadSim, defenderDeadSim], accumulations];

			function oneSide(frame, battleSide){
				var otherSide = game.BattleSide.opponent(battleSide);
				if (frame[battleSide].abilities.length > 0){

					// var ability = frame[battleSide].abilities.shift();
					

					const idx = frame[battleSide].abilities.findIndex(obj => obj.unit === undefined || obj.condition(obj.unit, obj.unitSide, battleSide, battleType,  frame.state, frame.accumulation, options));

					
					

					if (idx !== -1){
						ability = frame[battleSide].abilities[idx];
						frame[battleSide].abilities.splice(idx,1);
					} else {
						frame[battleSide].pass = true;
						return;
					}

					
					

					

					var [tran, newStat, newDeadUnits, newAcc] = ability.deathEffect(ability.unit, battleSide, battleType, frame.state, frame.accumulation, options);
					
					

					if (tran !== undefined && tran.length > 0){
						

						
						
						var tempStack = []

						for (var i = 0; i < tran.length; i++){

							var attackerDead = newDeadUnits[i][0];
							var defenderDead = newDeadUnits[i][1];

							var attackerDeadSim = simpleListClone(frame.attacker.deadSim);
							var defenderDeadSim = simpleListClone(frame.defender.deadSim);

							if (attackerDead.length > 0){
								for (const unit of attackerDead){
								
									// attackerDeadSim.push({
									// 	isDamageGhost: unit.isDamageGhost,
									// 	type: unit.type,
									// 	label: unit.label,
									// 	abilities: unit.abilities,
									// })
									attackerDeadSim.push(unit)

									if (unit.ghostCorporeal && newStat[i].attacker.includes(unit.ghostCorporeal)){
										const index = newStat[i].attacker.indexOf(unit.ghostCorporeal);
										if (index !== -1) {
											attackerDead.push(newStat[i].attacker.splice(index, 1)[0]);

											// attackerDeadSim.push({
											// 	isDamageGhost: unit.ghostCorporeal.isDamageGhost,
											// 	type: unit.ghostCorporeal.type,
											// 	label: unit.label,
											// abilities: unit.abilities,
											// })
											attackerDeadSim.push(unit)
										}
									}
								}
								if (attackerSort){
									game.fleetSort(newStat[i].attacker, battleType, options.attacker);
								}
							}

							if (defenderDead.length > 0){
								for (const unit of defenderDead){
								
									// defenderDeadSim.push({
									// 	isDamageGhost: unit.isDamageGhost,
									// 	type: unit.type,
									// 	label: unit.label,
									// 	abilities: unit.abilities,
									// })
									defenderDeadSim.push(unit);

									if (unit.ghostCorporeal && newStat[i].defender.includes(unit.ghostCorporeal)){
										const index = newStat[i].defender.indexOf(unit.ghostCorporeal);
										if (index !== -1) {
											defenderDead.push(newStat[i].defender.splice(index, 1)[0]);

											// defenderDeadSim.push({
											// 	isDamageGhost: unit.ghostCorporeal.isDamageGhost,
											// 	type: unit.ghostCorporeal.type,
											// 	label: unit.label,
											// 	abilities: unit.abilities,
											// })
											defenderDeadSim.push(unit)
										}
									}
								}
								if (defenderSort){
									game.fleetSort(newStat[i].defender, battleType, options.defender);
								}
							}

							
							
							var [attackerAbilities, defenderAbilities] = getDeathAbilities(attackerDead, defenderDead, frame.state, frame.accumulation);

							tempStack.push({
								state: newStat[i],
								attacker: {
									pass: false,
									abilities: frame.attacker.abilities.concat(attackerAbilities).sort(sortFunction),
									deadSim: attackerDeadSim,
									// sorted: frame.attacker.sorted,
								},
								defender: {
									pass: false,
									abilities: frame.defender.abilities.concat(defenderAbilities).sort(sortFunction),
									deadSim: defenderDeadSim,
									// sorted: frame.defender.sorted,
								},
								transition: frame.transition * tran[i],
								accumulation: newAcc[i],
							})
							
						}

						
						
						var first = tempStack.shift();
						
						frame.state = first.state;
						frame.transition = first.transition;
						frame.attacker.abilities = first.attacker.abilities;
						frame.defender.abilities = first.defender.abilities;
						frame.accumulation = first.accumulation;

						
						stack.push(...tempStack);
						
						
					}

					frame.attacker.pass = false;
					frame.defender.pass = false;

				} else {
					frame[battleSide].pass = true;
				}
				return;

			}

			function getDeathAbilities(deadAttacker, deadDefender, stateTemp, accumulationTemp){
				var attackerAbilities = [];
				var defenderAbilities = [];
				for (const unit of deadAttacker){
					oneSide(unit, game.BattleSide.attacker, game.BattleSide.defender, attackerAbilities, defenderAbilities)
				}
				for (const unit of deadDefender){
					oneSide(unit, game.BattleSide.defender, game.BattleSide.attacker, defenderAbilities, attackerAbilities)
				}

				return [attackerAbilities, defenderAbilities];

				function oneSide(deadUnit, thisSide, otherSide, thisSideAbilities, otherSideAbilities){
					
					for (const flagPointer of deadUnit.flagPointers){
						const index = state.flags[flagPointer.side].indexOf(flagPointer);
						
						if (index !== -1) {
							state.flags[flagPointer.side].splice(index,1);

							const ability = continuousUnitAbilities[flagPointer.name];
							
							if (ability && ability.terminate !== undefined){
								
								thisSideAbilities.push({
									condition: obj => true,
									deathEffect: ability.terminate,
									unit: deadUnit,
									unitSide: thisSide,
									priority: typeof ability.priority === 'function' ?  ability.priority(deadUnit) : ability.priority,
								})
							}
							

							

							
						}
					}
					for (const ability of deathEffects){
						if (checkTiming(stateTemp.timing, ability.timing)){
							if (ability.condition(deadUnit, thisSide, thisSide,  battleType,  stateTemp, accumulationTemp, options)){
								thisSideAbilities.push({
									condition: ability.condition,
									deathEffect: ability.destroyEffect,
									unit: deadUnit,
									unitSide: thisSide,
									priority: typeof ability.priority === 'function' ?  ability.priority(deadUnit) : ability.priority,
								})
							}
							if (ability.condition(deadUnit, thisSide, otherSide, battleType,  stateTemp, accumulationTemp, options)){
								otherSideAbilities.push({
									condition: ability.condition,
									deathEffect: ability.destroyEffect,
									unit: deadUnit,
									unitSide: thisSide,
									priority: typeof ability.priority === 'function' ?  ability.priority(deadUnit) : ability.priority,
								})
							}
						}
					}
				}
			}

			// function makeDeathAbilities(deadUnitsThisSide, deadUnitOtherSide, battleSide, sta, acc){
			// 	var abilitySuggestions=[];
			// 	var otherSide = game.BattleSide.opponent(battleSide);
				
			// 	for (const unit of deadUnitsThisSide){
			// 		unit.side = battleSide;
			// 		for (const ability of resolveSingleDead(sta, unit, battleSide, battleType, acc, options)){
						
			// 			abilitySuggestions.push(ability);
						
			// 		}
			// 		delete unit.side;
					

			// 	}

			// 	for (const unit of deadUnitOtherSide){
			// 		unit.side = otherSide;
			// 		for (const ability of resolveSingleDead(sta, unit, battleSide, battleType, acc, options)){
						
			// 			abilitySuggestions.push(ability);
						
			// 		}
			// 		delete unit.side;

			// 	}

			// 	return abilitySuggestions;
				
				
			// }
			
		}



		

		function assignHitsStep(attackerFleet, attackerHits, attackerHitsSpecial, defenderFleet, defenderHits, defenderHitsSpecial, attackerHardPredicate, attackerSoftPredicate, attackerSpecialSoftPredicate, defenderHardPredicate, defenderSoftPredicate, defenderSpecialSoftPredicate, battleType,  state, accumulation, options, passmode=false){

		

			const isCombat = checkTiming(state.timing, 'duringCombat_');

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
					if (defenderHitsSpecial > 0){
						const [attackerUnit, attackerIndex] = findUnit(attackerFleet, attackerHardPredicate, attackerSoftPredicate, attackerSpecialSoftPredicate);
						if (attackerUnit){
							
							const output = hit(attackerUnit, attackerIndex, attackerFleet, attackerDeadUnits, game.BattleSide.attacker, battleType, state, accumulation, options)
							
							defenderHitsSpecial -= output[0];
							attackerHits += output[1];

							attackerPass=false;
							defenderPass=false;
						} else {
							attackerPass = true;
						}
					} else {
					if (defenderHits > 0){
						const [attackerUnit, attackerIndex] = findUnit(attackerFleet, attackerHardPredicate, attackerSoftPredicate, attackerSpecialSoftPredicate);
						if (attackerUnit){
							
							const output = hit(attackerUnit, attackerIndex, attackerFleet, attackerDeadUnits, game.BattleSide.attacker, battleType, state, accumulation, options)
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
					}

					if (attackerPass && defenderPass) { break;}

					if (attackerHitsSpecial > 0){
						const [defenderUnit, defenderIndex] = findUnit(defenderFleet, defenderHardPredicate, defenderSoftPredicate, defenderSpecialSoftPredicate);
						if (defenderUnit){
							
							const output = hit(defenderUnit, defenderIndex, defenderFleet, defenderDeadUnits, game.BattleSide.defender, battleType, state, accumulation, options)
							attackerHitsSpecial -= output[0];
							defenderHits += output[1];

							attackerPass=false;
							defenderPass=false;
						} else {
							defenderPass = true;
						}
					} else {
					if (attackerHits > 0){
						const [defenderUnit, defenderIndex] = findUnit(defenderFleet, defenderHardPredicate, defenderSoftPredicate, defenderSpecialSoftPredicate);
						if (defenderUnit){
							
							const output = hit(defenderUnit, defenderIndex, defenderFleet, defenderDeadUnits, game.BattleSide.defender, battleType, state, accumulation, options)
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
					
				}

			} else {
				
				while (defenderHitsSpecial > 0 && loops<10000){
					loops++;
					const [attackerUnit, attackerIndex] = findUnit(attackerFleet, attackerHardPredicate, attackerSoftPredicate, attackerSpecialSoftPredicate);
					if (attackerUnit){
						
						const output = hit(attackerUnit, attackerIndex, attackerFleet, attackerDeadUnits, game.BattleSide.attacker, battleType, state, accumulation, options)
						defenderHitsSpecial -= output[0];		
					} else {
						break;
					}
				}
				defenderHits += defenderHitsSpecial;
				
				while (defenderHits > 0 && loops<10000){
					loops++;
					const [attackerUnit, attackerIndex] = findUnit(attackerFleet, attackerHardPredicate, attackerSoftPredicate, undefined);
					if (attackerUnit){
						
						const output = hit(attackerUnit, attackerIndex, attackerFleet, attackerDeadUnits, game.BattleSide.attacker, battleType, state, accumulation, options)
						defenderHits -= output[0];
					} else {
						break;
					}
					
				}

				while (attackerHitsSpecial > 0 && loops<10000){
					loops++;
					const [defenderUnit, defenderIndex] = findUnit(defenderFleet, defenderHardPredicate, defenderSoftPredicate, defenderSpecialSoftPredicate);
					if (defenderUnit){
						
						const output = hit(defenderUnit, defenderIndex, defenderFleet, defenderDeadUnits, game.BattleSide.defender, battleType, state, accumulation, options)
						attackerHitsSpecial -= output[0];
					} else {
						break
					}
				}

				attackerHits += attackerHitsSpecial;

				while (attackerHits > 0 && loops<10000){
					loops++;
					const [defenderUnit, defenderIndex] = findUnit(defenderFleet, defenderHardPredicate, defenderSoftPredicate, undefined);
					if (defenderUnit){
						
						const output = hit(defenderUnit, defenderIndex, defenderFleet, defenderDeadUnits, game.BattleSide.defender, battleType, state, accumulation, options)

						
						attackerHits -= output[0];
					} else {
						break;
					}
				}
			}

			if (loops >= 10000){
				print("ERROR error Loops Max Achieved assign hits")
			}

			for (const unit of attackerFleet){
				if (unit.alreadySustained){
					unit.update({alreadySustained: false, immune: false})
				}
			}
			for (const unit of defenderFleet){
				if (unit.alreadySustained){
					unit.update({alreadySustained: false, immune: false})
				}
			}

			return [attackerDeadUnits, defenderDeadUnits, attackerHits+attackerHitsSpecial, defenderHits+defenderHitsSpecial];

			// it would be faster to cache which soft predicates it can do, but special soft predicates are so rare, that this doesn't really matter
			function findUnit(fleet, hardPredicate, softPredicate, specialSoftPredicate){
				for (var i = fleet.length - 1; 0 <= i; i--) {
					const unit = fleet[i];
					const hard = unit.isDamageGhost && unit.damageCorporeal ? hardPredicate(unit.damageCorporeal) && hardPredicate(unit) : hardPredicate(unit);
					if (hard && (!softPredicate || softPredicate(unit)) && (!specialSoftPredicate || specialSoftPredicate(unit))) {
						return [unit,i]
					}
				}
				if (softPredicate) {
					for (var i = fleet.length - 1; 0 <= i; i--) {
						const unit = fleet[i];
						const hard = unit.isDamageGhost && unit.damageCorporeal ? hardPredicate(unit.damageCorporeal) && hardPredicate(unit) : hardPredicate(unit);
						if (hard && (!specialSoftPredicate || specialSoftPredicate(unit))) {
							return [unit,i];
						}
					}
				}
				if (specialSoftPredicate) {
					for (var i = fleet.length - 1; 0 <= i; i--) {
						const unit = fleet[i];
						const hard = unit.isDamageGhost && unit.damageCorporeal ? hardPredicate(unit.damageCorporeal) && hardPredicate(unit) : hardPredicate(unit);
						if (hard && (!softPredicate || softPredicate(unit)) ) {
							return [unit,i];
						}
					}
				}
				if (softPredicate && specialSoftPredicate) {
					for (var i = fleet.length - 1; 0 <= i; i--) {
						const unit = fleet[i];
						const hard = unit.isDamageGhost && unit.damageCorporeal ? hardPredicate(unit.damageCorporeal) && hardPredicate(unit) : hardPredicate(unit);
						if (hard) {
							return [unit,i];
						}
					}
				}
				return [undefined, undefined]
			}
			
			function hit(unit, i, fleet, deadUnits, battleSide, battleType, state, accumulation, options) {

				

				var cancelled = 1;
				var added = 0;

				

				var didItDie = false;

				if (unit.isDamageGhost) {
					[cancelled,added, didItDie] = sustainDamageEffect(unit, battleSide, battleType, state, accumulation, options, isCombat);
					
					
				}

				if (!unit.immune){
					deadUnits.push(unit);
					fleet.splice(i,1);
				}
				

				if (didItDie && unit.damageCorporeal){
					const idx = fleet.indexOf(unit.damageCorporeal);
					if (idx !== -1) {
						deadUnits.push(fleet.splice(idx,1)[0]);
					}
				}

				
				
				
				
				return [cancelled, added];
			}
			
		}

		function sustainDamageEffect(unit, battleSide, battleType,  state, accumulation, options, isCombat) {
			if (options[battleSide].baronyCommander){
				accumulation[battleSide].tgsEarned++;
			}
			var kill = false;
			if (unit.damageCorporeal !== undefined) {

				var empyreanFlagship = (options[battleSide].empyreanFlagshipSupport || state.flags[battleSide].some(obj => obj.name === 'empyreanFlagship')) && state.resources[battleSide].tgs?.total >= 2;

				const changes = {
					damaged:true, 
					ghostCorporeal:undefined,
				}

				if (isCombat) changes.sustainedThisRound = true;

				
				if (empyreanFlagship && battleSide === game.BattleSide.attacker && !kill){
					accumulation[battleSide].tgsSpend += 2;
					state.resources[battleSide].tgs.total -= 2;
					delete changes.damaged;
					delete changes.ghostCorporeal;

					unit.update({immune: true, alreadySustained: true})
				}
				

				var otherSide = game.BattleSide.opponent(battleSide)
				
				if (state.resources[otherSide].directHit?.total > 0 && unit.damageCorporeal.typeShip && !unit.damageCorporeal.abilities.includes('directHitImmune')){
					
					kill = true;
					state.resources[otherSide].directHit.total-=1;
				} else if (state.resources[otherSide].spark?.total > 0 && !unit.damageCorporeal.abilities.includes('directHitImmune')){
					
					kill = true;
					state.resources[otherSide].spark.total-=1;
				}

				if (empyreanFlagship && battleSide === game.BattleSide.defender && !kill){
					accumulation[battleSide].tgsSpend += 2;
					state.resources[battleSide].tgs.total -= 2;
					delete changes.damaged;
					delete changes.ghostCorporeal;

					unit.update({immune: true, alreadySustained: true})
				}

				unit.damageCorporeal.update(changes);
			}

			var producedHits = 0;
			if (unit.typeShip && options[battleSide].reflectiveShielding && state.poles[battleSide].reflectiveShielding === undefined && isCombat){
				producedHits += 2;
				state.poles[battleSide].reflectiveShielding = 'RSH';
			}
			
			

			return [options[battleSide].nonEuclidean || (state.poles[battleSide].nonEuclideanOwns !== undefined) ? 2 : 1, producedHits, kill]; //cancelled hits, generated hits, did it die boolean
		}



		

		

		
		function cancelHitsPassing(startState, 
			attackerHardPredicate, attackerSoftPredicate, 
			defenderHardPredicate, defenderSoftPredicate,
			attackerSpecialSoftPredicate, defenderSpecialSoftPredicate,
			attackerHits, defenderHits,
			attackerHitsNonFighter, defenderHitsNonFighter, 
			attackerHitsRemainingSim, defenderHitsRemainingSim,
			attackerDeadUnits, defenderDeadUnits,
			didAttackerLose, didDefenderLose,
			throwType, battleType, options, accumulation, prob=1,
		){

			

			var isCombat = checkTiming(startState.timing, 'duringCombat_');


			var transitions = [];
			var newStates = [];
			var newAccumulations = [];
			var attackerHitsOutput = [];
			var defenderHitsOutput = [];
			var attackerHitsSpecialOutput = [];
			var defenderHitsSpecialOutput = [];
			// var attackerSpent = [];
			// var defenderSpent = [];

			var attackerDeadSim = [];
			var defenderDeadSim = [];

			var attackerBestDead = [];
			var defenderBestDead = [];

			

			if (startState.resources.attacker.divinity?.total > 0){
				
				game.fleetSort(attackerDeadUnits, battleType, options.attacker);
				attackerBestDead = attackerDeadUnits.filter(obj => !obj.isDamageGhost).slice(0, startState.resources.attacker.divinity.total)
			}

			if (startState.resources.defender.divinity?.total > 0){
				game.fleetSort(defenderDeadUnits, battleType, options.defender);
				defenderBestDead = defenderDeadUnits.filter(obj => !obj.isDamageGhost).slice(0, startState.resources.defender.divinity.total)
			}

			const constants = {
				attacker:{
					do: attackerDeadUnits.length > 0,
					dead: attackerDeadUnits,
					hitsNonFighter: attackerHitsNonFighter,
					hitsRemainingSim: attackerHitsRemainingSim,
					didLose: didAttackerLose,
					hardPredicate: attackerHardPredicate,
					softPredicate: attackerSoftPredicate,
					specialSoftPredicate:  attackerSpecialSoftPredicate,
					bestDead: attackerBestDead,
				},
				defender:{
					do: defenderDeadUnits.length > 0,
					dead: defenderDeadUnits,
					hitsNonFighter: defenderHitsNonFighter,
					hitsRemainingSim: defenderHitsRemainingSim,
					didLose: didDefenderLose,
					hardPredicate: defenderHardPredicate,
					softPredicate: defenderSoftPredicate,
					specialSoftPredicate:  defenderSpecialSoftPredicate,
					bestDead: defenderBestDead,
				}
			}

			var stack = [];

			stack.push({
				state: startState,
				attacker:{
					pass: false,
					hitsCancelled: 0,
					hits: attackerHits,
					once: new Set(),
					dead: [],
					usedVoid : false,
					divinity: 0,
				},
				defender:{
					pass: false,
					hitsCancelled: 0,
					hits: defenderHits,
					once: new Set(),
					dead: [],
					usedVoid : false,
					divinity: 0,
				},
				transition: prob,
				accumulation:accumulation,
			})

			while (stack.length){
				const frame = stack.shift();

				

				while (!(frame.attacker.pass && frame.defender.pass)){
					oneSide(frame, game.BattleSide.attacker, game.BattleSide.defender);

					if (frame.attacker.pass && frame.defender.pass) { break}

					oneSide(frame, game.BattleSide.defender, game.BattleSide.attacker);


				}

				

				transitions.push(frame.transition);
				newStates.push(frame.state);
				newAccumulations.push(frame.accumulation);

				attackerHitsOutput.push(Math.max(frame.attacker.hits - Math.max(frame.attacker.hitsCancelled - constants.attacker.hitsNonFighter,0),0));
				attackerHitsSpecialOutput.push(Math.max(constants.attacker.hitsNonFighter- frame.attacker.hitsCancelled,0));

				defenderHitsOutput.push(Math.max(frame.defender.hits - Math.max(frame.defender.hitsCancelled - constants.defender.hitsNonFighter,0),0));
				defenderHitsSpecialOutput.push(Math.max(constants.defender.hitsNonFighter- frame.defender.hitsCancelled,0));

				// attackerSpent.push(0);
				// defenderSpent.push(0);

				attackerDeadSim.push(frame.attacker.dead);
				defenderDeadSim.push(frame.defender.dead);

			}

			return [transitions, newStates, newAccumulations, [attackerHitsOutput, defenderHitsOutput, attackerHitsSpecialOutput, defenderHitsSpecialOutput], [attackerDeadSim, defenderDeadSim]];
			

			function getSustain(frame, battleSide, otherSide){

				var best = undefined;
				var couldUseVoid = options[battleSide].voidShielding && !frame[battleSide].usedVoid;

				

				for (var i = frame.state[battleSide].length - 1; 0 <= i; i--) {
					var unit = frame.state[battleSide][i];

					

					var priority = 0 + (options[battleSide].duraniumArmor || frame.state.poles[battleSide].duraniumArmorOwns !== undefined) + (options[battleSide].nonEuclidean || frame.state.poles[battleSide].nonEuclideanOwns !== undefined);

					

					
					
					
					
					if ((unit.isDamageGhost || (couldUseVoid && !unit.damaged && !unit.notUseSustain)) && constants[battleSide].hardPredicate(unit) && 
					(constants[battleSide].softPredicate === undefined || constants[battleSide].softPredicate(unit)) &&
					(constants[battleSide].specialSoftPredicate === undefined || frame[battleSide].hitsCancelled >= constants[battleSide].hitsNonFighter || constants[battleSide].specialSoftPredicate(unit))){
							

							var idx = i;
							if (!unit.isDamageGhost){
								
								unit = unit.toDamageGhost()
								frame[battleSide].usedVoid = true;
								idx = frame.state[battleSide].length;
								frame.state[battleSide].push(unit);
								priority += 2;
							}

							var diff = constants[otherSide].hitsRemainingSim - frame[battleSide].hitsCancelled;
							if (frame[battleSide].divinity < frame.state.resources[battleSide].divinity?.total && (diff > 0 || (diff === 0 && constants[battleSide].didLose)) && unit.damageCorporeal){
								var changes = {damaged: true};
								if (isCombat){
									changes.sustainedThisRound = true;
								}
								var unitTemp = unit.damageCorporeal.update(changes)
								if (constants[battleSide].bestDead.some(obj => obj.label === unit.damageCorporeal.label || obj.label === unitTemp.label)){
								 
									frame[battleSide].divinity++;
									unit.update({immune: true, alreadySustained: true});
									continue;
								}

							}
						
							const output = {
								name:'sustainDamage',
								effect: function(){
									const output = sustainDamageEffect(unit, battleSide, battleType, frame.state, frame.accumulation, options, isCombat);
									if (!unit.immune){
										frame.state[battleSide].splice(this.index,1);
									}
									return output;

									
									
									
								},
								priority: priority,
								pointer: unit,
								index: idx, 
							}
							// if void is not is play, or we are using void, return immediately
							if (!couldUseVoid || idx !== i) return output;
							if (best === undefined) best = output;
							
							
							
						
						
					}
				}

				if (constants[battleSide].softPredicate){
					for (var i = frame.state[battleSide].length - 1; 0 <= i; i--) {
						const unit = frame.state[battleSide][i];
						if ((unit.isDamageGhost || (options[battleSide].voidShielding && !frame[battleSide].usedVoid && !unit.damaged && !unit.notUseSustain)) && constants[battleSide].hardPredicate(unit) &&
							(!constants[battleSide].specialSoftPredicate || frame[battleSide].hitsCancelled >= constants[battleSide].hitsNonFighter || constants[battleSide].specialSoftPredicate(unit))){

								

							var idx = i;
							if (!unit.isDamageGhost){
								unit = unit.toDamageGhost()
								frame[battleSide].usedVoid = true;
								idx = frame.state[battleSide].length;
								frame.state[battleSide].push(unit);
								priority += 2;
							}


							var diff = constants[otherSide].hitsRemainingSim - frame[battleSide].hitsCancelled;
							if (frame[battleSide].divinity < frame.state.resources[battleSide].divinity?.total && (diff > 0 || (diff === 0 && constants[battleSide].didLose)) && unit.damageCorporeal){
								var changes = {damaged: true};
								if (isCombat){
									changes.sustainedThisRound = true;
								}
								var unitTemp = unit.damageCorporeal.update(changes)
								if (constants[battleSide].bestDead.some(obj => obj.label === unit.damageCorporeal.label || obj.label === unitTemp.label)){
								 
									frame[battleSide].divinity++;
									unit.update({immune: true, alreadySustained: true});
									continue;
								}

							}


							const output = {
								name:'sustainDamage',
								effect: function(){
									const output = sustainDamageEffect(unit, battleSide, battleType, frame.state, frame.accumulation, options, isCombat);
									if (!unit.immune){
										frame.state[battleSide].splice(this.index,1);
									}
									return output;
								},
								priority: priority,
								pointer: unit,
								index: idx,
							}
							if (!couldUseVoid || idx !== i) return output;
							
							if (best === undefined) best = output;
						}
					}
				}

				if (constants[battleSide].specialSoftPredicate){
					for (var i = frame.state[battleSide].length - 1; 0 <= i; i--) {
						const unit = frame.state[battleSide][i];
						if ((unit.isDamageGhost || (options[battleSide].voidShielding && !frame[battleSide].usedVoid && !unit.damaged && !unit.notUseSustain)) && constants[battleSide].hardPredicate(unit) &&
							(!constants[battleSide].softPredicate || constants[battleSide].softPredicate(unit))){

								

							var idx = i;
							if (!unit.isDamageGhost){
								unit = unit.toDamageGhost()
								frame[battleSide].usedVoid = true;
								idx = frame.state[battleSide].length;
								frame.state[battleSide].push(unit);
								priority += 2;
							}


							var diff = constants[otherSide].hitsRemainingSim - frame[battleSide].hitsCancelled;
							if (frame[battleSide].divinity < frame.state.resources[battleSide].divinity?.total && (diff > 0 || (diff === 0 && constants[battleSide].didLose)) && unit.damageCorporeal){
								var changes = {damaged: true};
								if (isCombat){
									changes.sustainedThisRound = true;
								}
								var unitTemp = unit.damageCorporeal.update(changes)
								if (constants[battleSide].bestDead.some(obj => obj.label === unit.damageCorporeal.label || obj.label === unitTemp.label)){
								 
									frame[battleSide].divinity++;
									unit.update({immune: true, alreadySustained: true});
									continue;
								}

							}



							const output = {
								name:'sustainDamage',
								effect: function(){
									const output = sustainDamageEffect(unit, battleSide, battleType, frame.state, frame.accumulation, options, isCombat);
									if (!unit.immune){
										frame.state[battleSide].splice(this.index,1);
									}
									return output;
								},
								priority: priority,
								pointer: unit,
								index: idx,
							}
							if (!couldUseVoid || idx !== i) return output;
							
							if (best === undefined) best = output;
						}
					}
				}

				if (constants[battleSide].softPredicate && constants[battleSide].specialSoftPredicate){
					for (var i = frame.state[battleSide].length - 1; 0 <= i; i--) {
						const unit = frame.state[battleSide][i];
						if ((unit.isDamageGhost || (options[battleSide].voidShielding && !frame[battleSide].usedVoid && !unit.damaged && !unit.notUseSustain)) && constants[battleSide].hardPredicate(unit)){

							

							var idx = i;
							if (!unit.isDamageGhost){
								unit = unit.toDamageGhost()
								frame[battleSide].usedVoid = true;
								idx = frame.state[battleSide].length;
								frame.state[battleSide].push(unit);
								priority += 2;
							}


							var diff = constants[otherSide].hitsRemainingSim - frame[battleSide].hitsCancelled;
							if (frame[battleSide].divinity < frame.state.resources[battleSide].divinity?.total && (diff > 0 || (diff === 0 && constants[battleSide].didLose)) && unit.damageCorporeal){
								var changes = {damaged: true};
								if (isCombat){
									changes.sustainedThisRound = true;
								}
								var unitTemp = unit.damageCorporeal.update(changes)
								if (constants[battleSide].bestDead.some(obj => obj.label === unit.damageCorporeal.label || obj.label === unitTemp.label)){
								 
									frame[battleSide].divinity++;
									unit.update({immune: true, alreadySustained: true});
									continue;
								}

							}


							const output = {
								name:'sustainDamage',
								effect: function(){
									
									const output = sustainDamageEffect(unit, battleSide, battleType, frame.state, frame.accumulation, options, isCombat);
									if (!unit.immune){
										frame.state[battleSide].splice(this.index,1);
									}
									return output;
								},
								priority: priority,
								pointer: unit,
								index: idx,
							}
							if (!couldUseVoid || idx !== i) return output;
							
							if (best === undefined) best = output;
						}
					}
				}
				return best;
			}

			function oneSide(frame, battleSide, otherSide){

				

				

				
				
				if (constants[battleSide].do && frame[otherSide].hitsCancelled < frame[otherSide].hits + constants[otherSide].hitsNonFighter) {
					var bestPriority = -100;
					var cancels = [] // list of cancels we can do
					for (const cancelHit of cancelHits){
						if (cancelHit.priority > bestPriority){
							if (
							cancelHit.condition(
								frame.state[battleSide],
								Math.max(frame[otherSide].hits + constants[otherSide].hitsNonFighter-frame[otherSide].hitsCancelled,0),
								constants[otherSide].hitsRemainingSim,
								constants[battleSide].didLose,
								throwType,
								frame[battleSide].once,
								battleSide,
								battleType,
								frame.state,
								frame.accumulation,
								options
								) &&
							checkTiming(frame.state.timing, cancelHit.timing)

							){
								bestPriority = cancelHit.priority;
								cancels.push(cancelHit)
							}

						}
					}
					var hypotheticalMax = 0 + (options[battleSide].duraniumArmor || frame.state.poles[battleSide].duraniumArmorOwns !== undefined) + (options[battleSide].nonEuclidean || frame.state.poles[battleSide].nonEuclideanOwns !== undefined) + (frame[battleSide].usedVoid && options[battleSide].voidShielding !== undefined);
					
					if (bestPriority < hypotheticalMax){
						
						cancels.push(getSustain(frame, battleSide, otherSide))
						// print(cancels);
					}

					
					


					const cancel = cancels.length === 0
						? undefined
						: cancels.reduce((bestSoFar, cur) =>
							cur.priority > bestSoFar.priority ? cur : bestSoFar);

					if (cancel){
						const output = cancel.effect(frame.state[battleSide], battleSide, battleType, frame.state, frame.accumulation, options);

						frame[otherSide].hitsCancelled += output[0];
						frame[battleSide].hits += output[1];
						frame[battleSide].once.add(cancel.name);
						frame[battleSide].pass=false;
						frame[otherSide].pass=false;

						if (output[2] && cancel.pointer !== undefined && (!cancel.pointer.isDamageGhost || cancel.pointer.damageCorporeal !== undefined)){
							const deadUnit = cancel.pointer.isDamageGhost ? cancel.pointer.damageCorporeal : cancel.pointer;
							// frame[battleSide].dead.push({
							// 	isDamageGhost: deadUnit.isDamageGhost,
							// 	type: deadUnit.type,
							// 	label: deadUnit.label,
							// 	abilities: deadUnit.abilities,
							// });
							frame[battleSide].dead.push(deadUnit);
							

							
							if (battleSide === game.BattleSide.attacker){
								frame.state.attacker.splice(frame.state.attacker.indexOf(deadUnit),1)
								var [tran, newStat, newDead, newAccs] = resolveDead2(frame.state, [deadUnit], [], frame.accumulation, battleType, options);
							} else {
								frame.state.defender.splice(frame.state.defender.indexOf(deadUnit),1)
								var [tran, newStat, newDead, newAccs] = resolveDead2(frame.state, [], [deadUnit], frame.accumulation,  battleType, options);

								// var [tran, newStat, newDeadSims, newAccs] = resolveDead2(
							}

							

							if (tran.length > 0){
								
								var tempStack = []
								for (var i = 0; i < tran.length; i++){
									tempStack .push({
										state: newStat[i],
										attacker: {
											pass: false,
											hitsCancelled: frame.attacker.hitsCancelled,
											hits: frame.attacker.hits,
											once: new Set(frame.attacker.once),
											dead: simpleListClone(frame.attacker.dead).push(...newDead[0][i]),
											usedVoid: frame.attacker.usedVoid,
											divinity: frame.attacker.divinity,
										},
										defender: {
											pass: false,
											hitsCancelled: frame.defender.hitsCancelled,
											hits: frame.defender.hits,
											once: new Set(frame.defender.once),
											dead: simpleListClone(frame.defender.dead).push(...newDead[1][i]),
											usedVoid: frame.defender.usedVoid,
											divinity: frame.defender.divinity,
										},
										transition: frame.transition * tran[i],
										accumulation: newAccs[i],
										// accumulation: structuredClone(frame.accumulation),
									})

								}
								var first = tempStack.shift();
								frame.state = first.state;
								frame.transition = first.transition;
								frame.attacker = first.attacker;
								frame.defender = first.defender;
								frame.accumulation = first.accumulation;

								stack.push(...tempStack);
								
							}

							frame.attacker.pass = false;
							frame.defender.pass = false;
							
						}
					} else {
						frame[battleSide].pass=true;
					}
					

					
				} else {
					frame[battleSide].pass=true;
				}
			}
		}

		function takeHits2(startState, attackerHits, defenderHits, attackerHitsSpecial, defenderHitsSpecial,
			attackerSoftPredicate, defenderSoftPredicate, attackerSpecialSoftPredicate, defenderSpecialSoftPredicate, attackerSpent, defenderSpent, flagsToAdd, polesToAdd, delayedSpend, throwType, battleType, options, noSim=false, prob=1){

			var [attackerClone,defenderClone,flagsClone] = cloneFleetsAndFlags(startState.attacker,startState.defender,startState.flags);
			var polesClone = resourcesClone(startState.poles);
			var resClone = resourcesClone(startState.resources);

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

			if (polesToAdd && polesToAdd.attacker){
				polesClone.attacker[polesToAdd.attacker.name] = polesToAdd.attacker.shortType
				// polesClone.attacker[polesToAdd.attacker.name].shortType = polesToAdd.attacker.shortType;
				// polesClone.attacker[polesToAdd.attacker.name].value = true;
			}
			if (polesToAdd && polesToAdd.defender){
				polesClone.defender[polesToAdd.defender.name] = polesToAdd.defender.shortType;
				// polesClone.defender[polesToAdd.defender.name].shortType = polesToAdd.defender.shortType;
				// polesClone.defender[polesToAdd.defender.name].value = true;
			}
			
			if (delayedSpend && delayedSpend.attacker){
				Object.keys(delayedSpend.attacker).forEach(key => {
					resClone.attacker[key].total -= delayedSpend.attacker[key];
				});
			}
			if (delayedSpend && delayedSpend.defender){
				Object.keys(delayedSpend.defender).forEach(key => {
					
					resClone.defender[key].total -= delayedSpend.defender[key];
				});
			}
			
			
			
			var accClone = {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0};

			accClone.attacker.tgsSpent += attackerSpent;
			accClone.defender.tgsSpent += defenderSpent;
			if (resClone.attacker.tgs) resClone.attacker.tgs.total = Math.max(resClone.attacker.tgs.total - attackerSpent,0);
			if (resClone.defender.tgs) resClone.defender.tgs.total = Math.max(resClone.defender.tgs.total-defenderSpent,0);

			var clonedState = {
				attacker: attackerClone,
				defender: defenderClone,
				resources: resClone,
				flags: flagsClone,
				poles: polesClone,
				timing: startState.timing,
				prob: 0,
				
				terminal: false,
				retreat: startState.retreat,
				notParticipating: startState.notParticipating,
				
			}

			var attackerWaylay = false;
			var defenderWaylay = false;
			if (throwType === game.ThrowType.Barrage && clonedState.resources.attacker.waylay?.total > 0){
				clonedState.resources.attacker.waylay.total -= 1;
				attackerWaylay = true;
			}
			if (throwType === game.ThrowType.Barrage && clonedState.resources.defender.waylay?.total > 0){
				clonedState.resources.defender.waylay.total -= 1;
				defenderWaylay = true;
			}

			

			var stack = [];
			stack.push({
				state: clonedState,
				attacker:{
					
					hits: attackerHits,
					hitsSpecial: attackerHitsSpecial,
					// spent: attackerSpent,
					deadSim: [],
					
				},
				defender:{
					hits: defenderHits,
					hitsSpecial: defenderHitsSpecial,
					// spent: defenderSpent,
					deadSim: [],
				},
				transition: prob,
				accumulation: accClone,
				skip: undefined,
			})

			

			var hardPredicateAttacker = function(unit) {
				if (unit.immune) return false;
				if (unit.abilities.includes('naazRokhaMechImmune') && (throwType === game.ThrowType.Barrage || throwType === game.ThrowType.SpaceCannon || throwType === game.ThrowType.Bombardment)) return false;
				if (throwType === game.ThrowType.Barrage && !defenderWaylay) return unit.type === game.UnitType.Fighter;
				return true;
			};

			var hardPredicateDefender = function(unit) {
				if (unit.immune) return false;
				if (unit.abilities.includes('naazRokhaMechImmune') && (throwType === game.ThrowType.Barrage || throwType === game.ThrowType.SpaceCannon || throwType === game.ThrowType.Bombardment)) return false;
				if (throwType === game.ThrowType.Barrage && !attackerWaylay) return unit.type === game.UnitType.Fighter;
				return true;
			};

			var transitions = []
			var newStates = []
			var newAccumulations = [];
			var attackerDeadSims = [];
			var defenderDeadSims = [];
			// var didAttackerLoses = [];
			// var didDefenderLoses= [];
			var attackerHitsRemainings = [];
			var defenderHitsRemainings = [];

			

			while (stack.length){
				const frame = stack.shift();

				


				if (throwType === game.ThrowType.Barrage && (frame.skip !== 'barrage' && frame.skip !== 'cancel')){
					var deadUnits = {
						attacker : [],
						defender : [],
					}
					
					
					for (var i = 0; i < frame.state.attacker.length && frame.defender.hitsSpecial > 0; i++){
						const unit = frame.state.attacker[i];
						if (unit.type === game.UnitType.Infantry && !unit.invisible && !unit.immune && unit.spaceArea){
							deadUnits.attacker.push(frame.state.attacker.splice(i,1)[0]);
							frame.defender.hitsSpecial-=1;
							i--;
						}
					}

					for (var i = 0; i < frame.state.defender.length && frame.attacker.hitsSpecial > 0; i++){
						const unit = frame.state.defender[i];
						if (unit.type === game.UnitType.Infantry && !unit.invisible && !unit.immune && unit.spaceArea){
							deadUnits.defender.push(frame.state.defender.splice(i,1)[0]);
							frame.attacker.hitsSpecial-=1;
							i--;
						}
					}
					frame.attacker.hitsSpecial = 0;
					frame.defender.hitsSpecial = 0;

					if (options.attacker.abilities.raidFormation && frame.state.attacker.filter(unit => unit.barrageDice !== 0 && !unit.lostBarrage && !unit.notUseBarrage).length>0){
						var fighters = frame.state.defender.filter(obj => obj.type === game.UnitType.Fighter).length;
						var excess = frame.attacker.hits - fighters;
						for (var i = 0; i < frame.state.defender.length && excess > 0; i++){
							const unit = frame.state.defender[i];
							if (unit.isDamageGhost && unit.typeShip && !unit.invisible && !unit.immune && unit.damageCorporeal && unit.damageCorporeal.sustainDamage && !unit.damageCorporeal.lostSustain){
								
								unit.damageCorporeal.update({damaged:true, ghostCorporeal:undefined});
								deadUnits.defender.push(frame.state.defender.splice(i,1)[0]);
								excess--;
								i--;
							}
						}
					}

					if (options.defender.abilities.raidFormation && frame.state.defender.filter(unit => unit.barrageDice !== 0 && !unit.lostBarrage && !unit.notUseBarrage).length>0){
						var fighters = frame.state.attacker.filter(obj => obj.type === game.UnitType.Fighter).length;
						var excess = frame.defender.hits - fighters;
						for (var i = 0; i < frame.state.attacker.length && excess > 0; i++){
							const unit = frame.state.attacker[i];
							if (unit.isDamageGhost && unit.typeShip && !unit.invisible && !unit.immune && unit.damageCorporeal && unit.damageCorporeal.sustainDamage && !unit.damageCorporeal.lostSustain){
								
								unit.damageCorporeal.update({damaged:true, ghostCorporeal:undefined});
								deadUnits.attacker.push(frame.state.attacker.splice(i,1)[0]);
								excess--;
								i--;
							}
						}
					}

					var [tran, newStat, newAcc] = [[], undefined, undefined];
					
					if (deadUnits.attacker.length > 0 || deadUnits.defender.length > 0){
						
						var [tran, newStat, deadSim, newAcc]=resolveDead2(frame.state, deadUnits.attacker, deadUnits.defender, frame.accumulation, battleType, options);
					}
					if (tran.length > 0){
						for (var i = 1; i < tran.length; i++){
							stack.push({
								state: newStat[i],
								attacker: {
									hits: frame.attacker.hits,
									hitsSpecial: frame.attacker.hitsSpecial,
									
									deadSim: simpleListClone(frame.attacker.deadSim.concat(deadSim[0][i])),

								},
								defender: {
									hits: frame.defender.hits,
									hitsSpecial: frame.defender.hitsSpecial,
									// spent: frame.defender.spent + newSpent[1][i],
									deadSim: simpleListClone(frame.defender.deadSim.concat(deadSim[1][i])),
								},
								transition: frame.transition * tran[i],
								accumulation: newAcc[i],
								skip: 'barrage',
							})

						}
						frame.state = newStat[0];
						frame.transition = tran[0] * frame.transition;
						frame.accumulation = newAcc[0];
						

						frame.attacker.deadSim= frame.attacker.deadSim.concat(deadSim[0][0]);
						frame.defender.deadSim= frame.defender.deadSim.concat(deadSim[1][0]);
					}
				}
				

				if ((noSim === undefined || !noSim) && frame.skip !== 'cancel') {


					var [transitionsSim, newStatesSim, _,[attackerDeadSim, defenderDeadSim], [attackerHitsRemainingsSim, defenderHitsRemainingsSim]]= takeHits2(frame.state, frame.attacker.hits, frame.defender.hits, frame.attacker.hitsSpecial, frame.defender.hitsSpecial, attackerSoftPredicate, defenderSoftPredicate, attackerSpecialSoftPredicate, defenderSpecialSoftPredicate, 0, 0, undefined, undefined, undefined, throwType, battleType, options, true)

					const idx = transitionsSim.reduce(
						(bestIdx, x, i, a) => (x > a[bestIdx] ? i : bestIdx),
						0
					);

					
					var attackerSustainHardPredicate = makeSustainHardPredicate(attackerDeadSim[idx], hardPredicateAttacker, options.attacker);
					var defenderSustainHardPredicate = makeSustainHardPredicate(defenderDeadSim[idx], hardPredicateDefender, options.defender);

					// print([frame.attacker.hits, frame.defender.hits,
					// 	frame.attacker.hitsSpecial, frame.defender.hitsSpecial,])
					// print(frame.state)
					var [tran, newStat, newAcc, newHits,  deadSim] = cancelHitsPassing(
						frame.state,
						attackerSustainHardPredicate, attackerSoftPredicate, 
						defenderSustainHardPredicate, defenderSoftPredicate,
						attackerSpecialSoftPredicate, defenderSpecialSoftPredicate,
						frame.attacker.hits, frame.defender.hits,
						frame.attacker.hitsSpecial, frame.defender.hitsSpecial,
						attackerHitsRemainingsSim[idx], defenderHitsRemainingsSim[idx],
						attackerDeadSim[idx], defenderDeadSim[idx],
						fleetLength(newStatesSim[idx].attacker) === 0, 
						fleetLength(newStatesSim[idx].defender) === 0,
						throwType, battleType, options, frame.accumulation);

					// print(newStat)

					if (tran.length > 0){
						for (var i = 1; i < tran.length; i++){
							stack.push({
								state: newStat[i],
								attacker: {
									hits: newHits[0][i],
									hitsSpecial: newHits[2][i],
									// spent: frame.attacker.spent + newSpent[0][i],
									deadSim: simpleListClone(frame.attacker.deadSim.concat(deadSim[0][i])),

								},
								defender: {
									hits: newHits[1][i],
									hitsSpecial: newHits[3][i],
									// spent: frame.defender.spent + newSpent[1][i],
									deadSim: simpleListClone(frame.defender.deadSim.concat(deadSim[1][i])),
								},
								transition: frame.transition * tran[i],
								accumulation: newAcc[i],
								skip: 'cancel',
							})

						}
						frame.state = newStat[0];
						frame.transition = tran[0] * frame.transition;
						frame.attacker.hits = newHits[0][0];
						frame.attacker.hitsSpecial = newHits[2][0];
						frame.defender.hits = newHits[1][0];
						frame.defender.hitsSpecial = newHits[3][0];
						
						frame.accumulation = newAcc[0];
						// frame.accumulation = {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0};

						frame.attacker.deadSim= frame.attacker.deadSim.concat(deadSim[0][0]);
						frame.defender.deadSim= frame.defender.deadSim.concat(deadSim[1][0]);
					}
				}
				// var poi = frame.attacker.hits >= 2;
				// if (poi){
				// 	print(frame.attacker.hits);
				// 	print(frame.state)
				// 	print(frame.state.defender)
				// }
				
				const [attackerDeadUnits, defenderDeadUnits, attackerHitsRemaining, defenderHitsRemaining] = assignHitsStep(frame.state.attacker, frame.attacker.hits, frame.attacker.hitsSpecial, frame.state.defender, frame.defender.hits, frame.defender.hitsSpecial, hardPredicateAttacker, attackerSoftPredicate, attackerSpecialSoftPredicate, hardPredicateDefender, defenderSoftPredicate, defenderSpecialSoftPredicate, battleType, frame.state, frame.accumulation,options, noSim);
				// if (poi){
				// 	print(frame.state.defender);
				// 	print(frame.state);
				// }
				
				

				var [tran, newStat, newDeadSims, newAccs] = resolveDead2(frame.state, attackerDeadUnits, defenderDeadUnits, frame.accumulation, battleType, options, {noDivinity: noSim});

				

				if (tran.length > 0){
					for (var i = 0; i < tran.length; i++){

						

						transitions.push(frame.transition*tran[i]);
						newStates.push(newStat[i]);
						newAccumulations.push(newAccs[i]);
						
						// newAccumulations.push({attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0});
						attackerDeadSims.push(simpleListClone(frame.attacker.deadSim.concat(newDeadSims[0][i])));
						defenderDeadSims.push(simpleListClone(frame.defender.deadSim.concat(newDeadSims[1][i])));
						attackerHitsRemainings.push(attackerHitsRemaining);
						defenderHitsRemainings.push(defenderHitsRemaining);

						

					}
				} else {
					transitions.push(frame.transition);
					newStates.push(frame.state);
					newAccumulations.push(frame.accumulation);
					// newAccumulations.push();
					attackerDeadSims.push(frame.attacker.deadSim);
					defenderDeadSims.push(frame.defender.deadSim);
					attackerHitsRemainings.push(attackerHitsRemaining);
					defenderHitsRemainings.push(defenderHitsRemaining);

				}

				
			}

			
			// print(newStates);
			// if (newStates[0].attacker[0].sustainedThisRound){
			// 	print(newStates);
			// 	print(noSim);
			// }
			return [transitions, newStates, newAccumulations,[attackerDeadSims, defenderDeadSims], [attackerHitsRemainings,defenderHitsRemainings]];



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

		function combineAccumulationsMutate(obj1, obj2, modifier=1) {
			var scale = modifier;
			obj1.attacker.tgsEarned += obj2.attacker.tgsEarned * scale;
			obj1.attacker.tgsSpent += obj2.attacker.tgsSpent* scale;
			obj1.defender.tgsEarned += obj2.defender.tgsEarned * scale;
			obj1.defender.tgsSpent += obj2.defender.tgsSpent* scale;
			
			obj1.rounds += (obj2.rounds * scale);
			
			
		}

		function combineAccumulations(obj1, obj2, modifier=1) {
			var scale = modifier;
			var output = {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0}
			output.attacker.tgsEarned = obj1.attacker.tgsEarned + (obj2.attacker.tgsEarned * scale);
			output.attacker.tgsSpent = obj1.attacker.tgsSpent + (obj2.attacker.tgsSpent* scale);
			output.defender.tgsEarned = obj1.defender.tgsEarned + (obj2.defender.tgsEarned * scale);
			output.defender.tgsSpent = obj1.defender.tgsSpent + (obj2.defender.tgsSpent* scale);
			
			output.rounds = obj1.rounds + (obj2.rounds * scale);
			
			return output;
		}

		function matrixToStates(state, attackerTransitions3D, defenderTransitions3D, flagsToAdd, polesToAdd, delayedSpend, accumulations, throwType, battleType, options, elapsedMili, 
			{
				multiplier=1, 
				attackerTransitions3DNoThun = [[[1]]], 
				defenderTransitions3DNoThun = [[[1]]], 
				delayedSpendThun = {attacker:{}, defender: {}}, 
				attackerSpecialSoftPredicate = undefined, 
				defenderSpecialSoftPredicate= undefined,
				attackerSoftPredicate = undefined,
				defenderSoftPredicate = undefined,
			} = {}){

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

			var attackerSpecialSoftPredicate = attackerSpecialSoftPredicate ? attackerSpecialSoftPredicate : ( isCombat ? nonFighterShip : undefined);
			var defenderSpecialSoftPredicate = defenderSpecialSoftPredicate ? defenderSpecialSoftPredicate : ( isCombat ? nonFighterShip : undefined);


			var attackerValkyrie = isCombatRolls && (options.attacker.valkyrie || state.poles.attacker.valkyrieOwns !== undefined) && battleType === game.BattleType.Ground;

			var defenderValkyrie = isCombatRolls && (options.defender.valkyrie || state.poles.defender.valkyrieOwns !== undefined) && battleType === game.BattleType.Ground;

			

			

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

			
			var scale=multiplier;
			if (tick == (transitionMatrix.rows*transitionMatrix.columns * transitionMatrix.dim3 * transitionMatrix.dim4)){
			
				// console.log('trigger');
				transitionMatrix[transitionMatrix.rows-1][transitionMatrix.columns-1][transitionMatrix.dim3-1][transitionMatrix.dim4-1][0][0] = 1;
				scale = multiplier; 
			} else {
				scale = multiplier/(1-totalBelow);
			}

			
			var attackerThun = state.resources.attacker.nomadAgent?.total > 0 && isCombatRolls;
			var defenderThun = state.resources.defender.nomadAgent?.total > 0 && isCombatRolls;

			var pDefenderOutperforms = 0;
			var pAttackerOutperforms = 0

			if (attackerThun || defenderThun){
				// function expectedHits(probs, hitDims = [0, 2], indices = []) {
				// 	// Base case: innermost element (a probability value)
				// 	if (typeof probs === 'number') {
				// 		const totalHits = hitDims.reduce((sum, dim) => sum + (indices[dim] ?? 0), 0);
				// 		return probs * totalHits;
				// 	}

				// 	// Recursive case: dive deeper into the array
				// 	return probs.reduce(
				// 		(sum, subArray, i) => sum + expectedHits(subArray, hitDims, [...indices, i]),
				// 		0
				// 	);
				// }
				

				// var expectedAttacker = expectedHits(transitionMatrix, [0,2]);
				// var expectedDefender = expectedHits(transitionMatrix, [1,3]);

				
				function buildTotalHitsDistribution(probs, hitDims = [0, 2]) {
					// Use recursion to walk the nested arrays and accumulate probability mass
					const dist = new Map(); // totalHits -> probability

					function walk(node, indices = []) {
						if (typeof node === 'number') {
						const totalHits = hitDims.reduce((sum, dim) => sum + (indices[dim] || 0), 0);
						dist.set(totalHits, (dist.get(totalHits) || 0) + node);
						return;
						}

						if (!Array.isArray(node)) {
						throw new Error('Probabilities structure must be nested arrays with numbers at leaves.');
						}

						for (let i = 0; i < node.length; i++) {
						walk(node[i], [...indices, i]);
						}
					}

					walk(probs);
					return dist;
					}

					/* ----------------- helper: compute medians from distribution ----------------- */
					function computeMediansFromDistribution(distMap) {
					// Convert Map to sorted array of [totalHits, p] by totalHits ascending
					const entries = Array.from(distMap.entries()).sort((a, b) => a[0] - b[0]);
					const totalProb = entries.reduce((s, [, p]) => s + p, 0);

					// Build cumulative distribution P(X <= t) and tail distribution P(X >= t)
					let cum = 0;
					const cdf = new Map();   // P(X <= t)
					for (const [t, p] of entries) {
						cum += p;
						cdf.set(t, cum);
					}

					// For P(X >= t) we can compute from CDF or compute suffix sums
					const suffix = new Map();
					let suff = 0;
					for (let i = entries.length - 1; i >= 0; i--) {
						const [t, p] = entries[i];
						suff += p;
						suffix.set(t, suff);
					}

					// Tolerance for floating point comparisons
					const EPS = 1e-12;

					// lowerMedian: smallest t such that P(X <= t) >= 0.5
					let lowerMedian = null;
					for (const [t, pCum] of entries.map(e => [e[0], cdf.get(e[0])])) {
						if (pCum + EPS >= 0.5) {
						lowerMedian = t;
						break;
						}
					}

					// upperMedian: largest t such that P(X >= t) >= 0.5
					let upperMedian = null;
					for (let i = entries.length - 1; i >= 0; i--) {
						const t = entries[i][0];
						const pSuff = suffix.get(t);
						if (pSuff + EPS >= 0.5) {
						upperMedian = t;
						break;
						}
					}

					return {
						distribution: new Map(entries), // sorted map-like (still Map)
						lowerMedian,
						upperMedian,
						totalProb
					};
				}

				function mediansForHitDims(probs, hitDims = [0, 2]) {
					const dist = buildTotalHitsDistribution(probs, hitDims);
					return computeMediansFromDistribution(dist);
				}

				var transitionUsedAttacker = transitionMatrix;
				// var transitionUsedDefender = transitionMatrix;

				// if (state.resources.attacker.nomadAgent?.total === 1){
				// 	transitionUsedAttacker = orthogonalMultiplyMatrix3DSpecial(attackerTransitions3D, defenderTransitions3DNoThun);
				// }
				// if (state.resources.defender.nomadAgent?.total === 1){
				// 	transitionUsedDefender = orthogonalMultiplyMatrix3DSpecial(attackerTransitions3DNoThun, defenderTransitions3D);
				// }

				// var mediumsAttacker_A = mediansForHitDims(transitionUsedAttacker, [0,2]);
				// var mediumsDefender_A = mediansForHitDims(transitionUsedAttacker, [1,3]);

				// var mediumsAttacker_D = mediansForHitDims(transitionUsedDefender, [0,2]);
				// var mediumsDefender_D = mediansForHitDims(transitionUsedDefender, [1,3]);

				var mediumsAttacker_A = mediansForHitDims(transitionUsedAttacker, [0,2]);
				var mediumsDefender_A = mediansForHitDims(transitionUsedAttacker, [1,3]);

				var mediumsAttacker_D = mediumsAttacker_A;
				var mediumsDefender_D = mediumsDefender_A;

				
				

				

			}
			

			const stateIndexMap = new Map();
			var majorityIndex = 0;
			
			// var majorityAttackerInflicted = 0;
			// var majorityDefenderInflicted = 0;
			// var majorityAttackerInflicted = 0;
			// var majorityDefenderInflicted = 0;

			// var attackerSpecialSoftPredicate = isCombatRolls ? nonFighterShip : undefined;
			// var defenderSpecialSoftPredicate = isCombatRolls ? nonFighterShip : undefined;

			outer: 
			for (let attackerInflicted = 0; attackerInflicted < transitionMatrix.rows; attackerInflicted++) {
				for (let defenderInflicted = 0; defenderInflicted < transitionMatrix.columns; defenderInflicted++) {
					for (let attackerInflictedSpecial = 0; attackerInflictedSpecial < transitionMatrix.dim3; attackerInflictedSpecial++){
						for (let defenderInflictedSpecial = 0; defenderInflictedSpecial < transitionMatrix.dim4; defenderInflictedSpecial++){

						for (let attackerSpent = 0; attackerSpent < transitionMatrix.dim5; attackerSpent++){
						for (let defenderSpent = 0; defenderSpent < transitionMatrix.dim6; defenderSpent++){

							// prob = transitionMatrix.at(attackerInflicted, defenderInflicted);
							var prob = transitionMatrix[attackerInflicted][defenderInflicted][attackerInflictedSpecial][defenderInflictedSpecial][attackerSpent][defenderSpent] * scale;

							var attackerHits = attackerInflicted;
							var defenderHits = defenderInflicted;


							

							


							var attackerTotal = attackerHits + (isBarrage ? 0 : attackerInflictedSpecial);
							var defenderTotal = defenderHits + (isBarrage ? 0 : defenderInflictedSpecial);

								

								
								

								

							if (attackerThun && ((attackerTotal <= mediumsAttacker_A.upperMedian && defenderTotal > mediumsDefender_A.lowerMedian) || (attackerTotal < mediumsAttacker_A.upperMedian && defenderTotal >= mediumsDefender_A.lowerMedian))) {
								
								pDefenderOutperforms += prob;
								prob = 0;
							}

							if (defenderThun && ((defenderTotal <= mediumsDefender_D.upperMedian && attackerTotal > mediumsAttacker_D.lowerMedian) || (defenderTotal < mediumsDefender_D.upperMedian && attackerTotal >= mediumsAttacker_D.lowerMedian))) {
								pAttackerOutperforms += prob;
								prob = 0;
							}

							
							

							

							if (prob === 0){ continue;}

							
							if (attackerValkyrie && defenderValkyrie && attackerHits + attackerInflictedSpecial + defenderHits + defenderInflictedSpecial !== 0){
								attackerHits += 1;
								defenderHits += 1;

							} else if (attackerValkyrie && defenderHits + defenderInflictedSpecial !== 0){
								attackerHits += 1;
							} else if (defenderValkyrie && attackerHits + attackerInflictedSpecial !== 0){
								defenderHits += 1;
							}


							// print(state.timing)
							// print([prob, scale, transitionMatrix[attackerInflicted][defenderInflicted][attackerInflictedSpecial][defenderInflictedSpecial][attackerSpent][defenderSpent]])
							// print(transitionMatrix);
							// print([attackerInflicted, defenderInflicted, attackerInflictedSpecial, defenderInflictedSpecial]);
							// print(state.defender)
							// print(state)
							
							var [newTransitions, newStates, newAccs, , ] = takeHits2(state, attackerHits, defenderHits, attackerInflictedSpecial, defenderInflictedSpecial, attackerSoftPredicate, defenderSoftPredicate, attackerSpecialSoftPredicate,defenderSpecialSoftPredicate,  attackerSpent, defenderSpent, flagsToAdd, polesToAdd, delayedSpend, throwType, battleType, options, false, 1);

							

							// print(newStates[0].defender);
							// print(newStates[0]);
							// print('');


							for (var i = 0; i < newTransitions.length; i++){
								var newState = newStates[i];
								var thisProb = prob * newTransitions[i];
								var newAcc = newAccs[i];

								// print(newState);

								if (isCombatRolls){
									if (options.attacker.duraniumArmor || state.poles.attacker.duraniumArmorOwns){
										// print('trigger');
										

										duraniumArmorRepair(game.BattleSide.attacker, battleType, newState, newAcc, options);
									}
									if (options.defender.duraniumArmor || state.poles.defender.duraniumArmorOwns) {
										duraniumArmorRepair(game.BattleSide.defender, battleType, newState, newAcc, options);
									}
								}

								// print(newState.attacker)

								var thisKey = buildStateKey(newState.attacker, newState.defender, newState.resources, newState.flags, newState.poles);

								newState.startKey = thisKey;


								if (stateIndexMap.has(thisKey)) {
									const idx = stateIndexMap.get(thisKey);
									transitionArray[idx] += thisProb;
								} else {
									const thisIndex = newStatesArray.length;
									stateIndexMap.set(thisKey, thisIndex);

									rewardsArray.push(newAcc);
									transitionArray.push(thisProb);
									newStatesArray.push(newState);
								}

								const thatKey = stateIndexMap.get(thisKey);
								if (thisProb > 0.99999 || transitionArray[thatKey] > 0.99999){
									majorityIndex = thatKey;
									majorityInflicted = [attackerInflicted,defenderInflicted, attackerInflictedSpecial, defenderInflictedSpecial, attackerSpent, defenderSpent];
									break outer;
								}


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


				
				
				equal_state = newStatesArray[majorityIndex];

				state.attacker = equal_state.attacker;
				state.defender = equal_state.defender;
				state.flags = equal_state.flags;
				state.resources = equal_state.resources;
				state.poles = equal_state.poles;

				
				rewardsArray=[combineAccumulations(accumulations, rewardsArray[majorityIndex])];
				newStatesArray = [];
				transitionArray=[1];
				 

			} else {
				if (attackerThun && pDefenderOutperforms > 0){
					
					var [attackerClone,defenderClone,flagsClone] = cloneFleetsAndFlags(state.attacker,state.defender,state.flags);
					var resClone = resourcesClone(state.resources);
					var polesClone = resourcesClone(state.poles);

					

					var accClone = accumulationClone(accumulations);


					var stateClone = {
						attacker: attackerClone,
						defender: defenderClone,
						timing: state.timing,
						resources: resClone,
						flags: flagsClone,
						poles: polesClone,

						prob: state.prob,
						startKey: state.startKey,
						
						
						terminal: false,
						retreat: state.retreat,
						notParticipating: state.notParticipating,
					}

					var attackerMatrix = attackerTransitions3D;
					var defenderMatrix = defenderTransitions3D;
					var delay = delayedSpend;

					if (stateClone.resources.attacker.nomadAgent.total === 1){
						delay.defender = delayedSpendThun.defender;
						defenderMatrix = defenderTransitions3DNoThun;
					}

					stateClone.resources.attacker.nomadAgent.total -= 1;

					var [transitionArrayTemp, newStatesArrayTemp, rewardsArrayTemp, ] = matrixToStates(stateClone, attackerMatrix, defenderMatrix, flagsToAdd, polesToAdd, delay, accClone, throwType, battleType, options, elapsedMili, {pDefenderOutperforms, attackerTransitions3DNoThun, defenderTransitions3DNoThun, delayedSpendThun, attackerSpecialSoftPredicate, defenderSpecialSoftPredicate});

					
					transitionArray.push(...transitionArrayTemp);
					newStatesArray.push(...newStatesArrayTemp);
					rewardsArray.push(...rewardsArrayTemp);
				}

				if (defenderThun && pAttackerOutperforms > 0){
					
					var [attackerClone,defenderClone,flagsClone] = cloneFleetsAndFlags(state.attacker,state.defender,state.flags);
					var resClone = resourcesClone(state.resources);
					var polesClone = resourcesClone(state.poles);

					

					var accClone = accumulationClone(accumulations);


					var stateClone = {
						attacker: attackerClone,
						defender: defenderClone,
						timing: state.timing,
						resources: resClone,
						flags: flagsClone,
						poles: polesClone,

						prob: state.prob,
						startKey: state.startKey,
						
						
						terminal: false,
						retreat: state.retreat,
						notParticipating: state.notParticipating,
					}

					var attackerMatrix = attackerTransitions3D;
					var defenderMatrix = defenderTransitions3D;
					var delay = delayedSpend;

					if (stateClone.resources.defender.nomadAgent.total === 1){
						delay.attacker = delayedSpendThun.attacker;
						attackerMatrix = attackerTransitions3DNoThun;
					}

					stateClone.resources.defender.nomadAgent.total -= 1;

					var [transitionArrayTemp, newStatesArrayTemp, rewardsArrayTemp, ] = matrixToStates(stateClone, attackerMatrix, defenderMatrix, flagsToAdd, polesToAdd, delay, accClone, throwType, battleType, options, elapsedMili, {pAttackerOutperforms, attackerTransitions3DNoThun, defenderTransitions3DNoThun, delayedSpendThun, attackerSpecialSoftPredicate, defenderSpecialSoftPredicate});

					
					transitionArray.push(...transitionArrayTemp);
					newStatesArray.push(...newStatesArrayTemp);
					rewardsArray.push(...rewardsArrayTemp);
				}

				
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

			// var attackerFull = structuredClone(input.unitsFull.attacker);
			// var defenderFull = structuredClone(input.unitsFull.defender);

			const fakeState = {
				timing: 'beforeEverything', 
				flags: {
					attacker: [],
					defender: []
				},
				poles: {
					attacker: {},
					defender: {}
				},
				notParticipating: {
					attacker: [],
					defender: [],
				},
				attacker: attackerFull,
				defender: defenderFull,
			}

			applyContinuousEffectsOnUnits(attackerFull, game.BattleSide.attacker, battleType, fakeState, undefined, options);
			applyContinuousEffectsOnUnits(defenderFull, game.BattleSide.defender, battleType, fakeState, undefined, options);

			printCache(cache);

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

			// print(defender)
			// print(defenderNotParticipating)

			var infiniteCondition = (
				(options.attacker.duraniumArmor || options.attacker.copy.duraniumArmorCopy) &&
				(options.defender.duraniumArmor || options.defender.copy.duraniumArmorCopy)
			)

			everRetreat = false;

			

			


			

			var explorationMap = new Map();
			var states = new Map();

			var exitMap = new Map();
			

			

			

			
			


			function abilityPassing(state, battleType, accumulation){
				var attackerPass = false;
				var defenderPass = false;

				var passes = {
					attacker: false,
					defender: false,
				}


				const notParticipatingClone = {
					attacker: cloneFleet(attackerNotParticipating),
					defender: cloneFleet(defenderNotParticipating)
				}
				// const usedAttackerNotParticipating = cloneFleet(attackerNotParticipating);
				// const usedDefenderNotParticipating = cloneFleet(defenderNotParticipating);

				state.turn = game.BattleSide.attacker;
				var loops = 0
				while (!(attackerPass && defenderPass) && loops<10000){
					loops++;
					const outputA = oneSide(game.BattleSide.attacker, game.BattleSide.defender);
					if (outputA){
						return outputA
					}
					

					if (passes.attacker && passes.defender) { break;}
					
					const outputD = oneSide(game.BattleSide.defender, game.BattleSide.attacker,);
					if (outputD){
						return outputD
					}
					
				}

				function oneSide(battleSide, otherSide){
					if (state.turn === battleSide){
						var abilities=[];
						for (var i = 0; i < activations.length; i++) {
							
							if (activations[i].condition(undefined, battleSide, battleType, state, accumulation, options) && checkTiming(state.timing, activations[i].timing)){
								
								abilities.push(activations[i]);
							}
							
						}
						const abilityToUnit = new Map();
						for (var i = 0; i < state[battleSide].length; i++) {
							const unit = state[battleSide][i];
							
							for (var j = 0; j < unit.abilities.length; j++) {
								const abilityName = unit.abilities[j];
								const ability = continuousUnitAbilities[abilityName];
								
								
								if 	(ability && 
									 
									checkTiming(state.timing, ability.timing) && 
									!unit.flagPointers.some(item => item.name === abilityName) &&
									ability.condition(unit, battleSide, battleType, state, accumulation, options)
								){
									const abilityTemp = {
										name: ability.name,
										effect: ability.effect,
										priority: typeof ability.priority === 'function' ?  ability.priority(unit, battleSide, battleType, state, accumulation, options) : ability.priority,
										newUnitEffect: ability.newUnitEffect,
									}
									abilityToUnit.set(abilityTemp,unit);
									abilities.push(abilityTemp);
								}
							}
						}

						for (var i = 0; i < notParticipatingClone[battleSide].length; i++) {
							const unit = notParticipatingClone[battleSide][i];

							for (var j = 0; j < unit.abilities.length; j++) {
								const abilityName = unit.abilities[j];
								const ability = continuousUnitAbilities[abilityName];

								if 	(ability && 
									 
									checkTiming(state.timing, ability.timing, true) && 
									!unit.flagPointers.some(item => item.name === abilityName) &&
									ability.condition(unit, battleSide, battleType, state, accumulation, options)
								){
									abilityToUnit.set(ability,unit)
									abilities.push(ability);
								}
							}
						}

						var finalAbility = abilities.sort((a, b) => b.priority - a.priority)[0];
						
						if (finalAbility) {

							
							
							// const output = attackerAbility.effect(state.attacker,state.defender, 'attacker', battleType, state.resources.attacker, state.flags.attacker, state.flags.defender, options, abilityToUnit.get(attackerAbility), state, accumulation);

							const output = finalAbility.effect(abilityToUnit.get(finalAbility), battleSide, battleType, state, accumulation, options, notParticipatingClone);

							passes[battleSide] = false;
							passes[otherSide] = false;
							state.turn = otherSide;

							if (output){
								return output
							}
							
						} else {
							passes[battleSide] = true;
							state.turn = otherSide;
						}
						// print(state.attacker[0].flagPointers[0] === state.flags.defender[1]);
						// print(state.flags.defender);
					}
				}
				
				if (loops >= 10000){
					print('Loop MAXIMUM achieved abilitity passing!')
				}
				
			}

			

			

			function runState(state, accumulations, elapsedMili) {
				
				
				var outcome = [[1], [], [], false];
				switch (state.timing) {
					case "beforeEverything":

						var output = abilityPassing(state, battleType, accumulations);
						if (output){
							return output;
						}

						state.timing = 'spaceCannonOffense';
						break;
					
					case 'spaceCannonOffense':



						if (!state.poles.attacker.spaceCannonOffense && battleType === 'Space'){

							// if (state.substep === 0){

								

								const attackerFull = state.attacker.concat(attackerNotParticipating)
								const defenderFull = state.defender.concat(defenderNotParticipating)

								

								const [attackerTransitions3D,attackerDelayedSpend] = getSpaceCannonTransition(
									attackerFull, 
									defenderFull, 
									game.BattleSide.attacker,
									battleType, 
									state, 
									accumulations, 
									options,
								);
								
								const [defenderTransitions3D,defenderDelayedSpend]  =  getSpaceCannonTransition(
									defenderFull,
									attackerFull, 
									game.BattleSide.defender,
									battleType, 
									state, 
									accumulations, 
									options,
								);

								
								var delayedSpend = {
									attacker: attackerDelayedSpend,
									defender: defenderDelayedSpend,
								}

						

								
								var polesToAdd = {
									attacker:{
										name: 'spaceCannonOffense',
										shortType: 'SPO',
									},
									defender: {
										name: 'spaceCannonOffense',
										shortType: 'SPO',
									}
								}

								var attackerSoftPredicate = undefined;
								var defenderSoftPredicate = undefined;
								if (state.resources.attacker.converge?.total > 0){
									defenderSoftPredicate = function(unitIn){
									
										return unitIn.type !== game.UnitType.Fighter && unitIn.typeShip
									}
									// state.resources.attacker.converge.total -= 1;
									delayedSpend.attacker.converge = (delayedSpend.attacker.converge || 0) + 1;
								}
								if (state.resources.defender.converge?.total > 0){
									attackerSoftPredicate = function(unitIn){
									
										return unitIn.type !== game.UnitType.Fighter && unitIn.typeShip
									}
									delayedSpend.defender.converge = (delayedSpend.defender.converge || 0) + 1;
								}

								
								
								outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, undefined, polesToAdd, delayedSpend, accumulations, game.ThrowType.SpaceCannon, battleType,  options, elapsedMili, {
									attackerSoftPredicate: attackerSoftPredicate,
									defenderSoftPredicate: defenderSoftPredicate,
								});

							// }

							return outcome;
						}

						state.timing = 'bombardment';
						break;
					
					
					case 'bombardment':

						

						
						if (!state.poles.attacker.bombardment && battleType === 'Ground'){

							const filter = function(unit){
								return !unit.notActiveSystem;
							}

							const attackerFull = state.attacker.concat(attackerNotParticipating).filter(filter);
							const defenderFull = state.defender.concat(defenderNotParticipating);

							
							const [attackerTransitions3D,attackerDelayedSpend] = getBombardmentTransition(
								attackerFull, 
								defenderFull, 
								game.BattleSide.attacker,
								battleType, 
								state, 
								accumulations, 
								options,
							);
							const defenderTransitions3D  =  [[[1]]];

							
							var delayedSpend = {
								attacker: attackerDelayedSpend,
							}

					

							// var flagsToAdd = {attacker:undefined, defender:undefined};
							// flagsToAdd.attacker = {
							// 	name: 'bombardment',
							// 	shortType: 'BOM',
							// 	duration: -1,
							// };

							
							

							var polesToAdd = {
								attacker: {
									name: 'bombardment',
									shortType: 'BOM',
								}
							};


							
							
							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, undefined, polesToAdd, delayedSpend, accumulations, game.ThrowType.Bombardment, battleType,  options, elapsedMili);

							

							

							return outcome;
						}

						state.timing = 'spaceCannonDefense';
						break;
					case 'spaceCannonDefense':

						var output = abilityPassing(state, battleType, accumulations);
						if (output){
							return output;
						}

						if (!state.poles.defender.spaceCannonDefense && battleType === 'Ground'){

							const filter = function(unit){
								return unit.presentPlanet;
							}

							const attackerFull = state.attacker.concat(attackerNotParticipating);
							const defenderFull = state.defender.concat(defenderNotParticipating).filter(filter);

							const attackerTransitions3D = [[[1]]];
							

							
							const [defenderTransitions3D,defenderDelayedSpend]  =  getSpaceCannonTransition(
								defenderFull,
								attackerFull, 
								game.BattleSide.defender,
								battleType, 
								state, 
								accumulations, 
								options,
							);

							
							
							var delayedSpend = {
								defender: defenderDelayedSpend,
							}
					

							
							var polesToAdd = {
								defender:{
									name: 'spaceCannonDefense',
									shortType: 'SPD',
								}
							};

							var attackerSoftPredicate = undefined;
							var defenderSoftPredicate = undefined;
							if (state.resources.attacker.converge?.total > 0){
								defenderSoftPredicate = function(unitIn){
								
									return unitIn.type === game.UnitType.Mech;
								}
								
								delayedSpend.attacker.converge = (delayedSpend.attacker.converge || 0) + 1;
							}
							if (state.resources.defender.converge?.total > 0){
								attackerSoftPredicate = function(unitIn){
								
									return unitIn.type === game.UnitType.Mech;
								}
								delayedSpend.defender.converge = (delayedSpend.defender.converge || 0) + 1;
							}

							
							
							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, undefined, polesToAdd, delayedSpend, accumulations,  game.ThrowType.SpaceCannon, battleType, options, elapsedMili, {
									attackerSoftPredicate: attackerSoftPredicate,
									defenderSoftPredicate: defenderSoftPredicate,
							});
							

							return outcome;
						}



						
						

						

						state.timing = 'beforeCombat';
						break;

					case "beforeCombat":
						var output = abilityPassing(state, battleType, accumulations);
						if (output){

							return output;
						}

						state.terminal = (fleetLength(state.attacker) === 0 || fleetLength(state.defender) === 0);
						if (state.terminal){
							state.attacker = state.attacker.filter(obj => !obj.leaveEarly);
							state.defender = state.defender.filter(obj => !obj.leaveEarly);
							
							state.poles.attacker.beforeEverythingTerminal = 'BCT';
							state.poles.defender.beforeEverythingTerminal = 'BCT';

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
						state.timing = 'announceRetreat';
						break;
					
					
					case "barrage":

						if (!state.poles.attacker.barrage && battleType === 'Space'){

							// const attackerFull = state.attacker.concat(attackerNotParticipating);
							// const defenderFull = state.defender.concat(defenderNotParticipating);

							const [attackerTransitions3D,attackerDelayedSpend] = getBarrageTransition(
								state.attacker, 
								state.defender, 
								game.BattleSide.attacker,
								battleType, 
								state, 
								accumulations, 
								options,
							);
							const [defenderTransitions3D,defenderDelayedSpend]  =  getBarrageTransition(
								state.defender,
								state.attacker,
								game.BattleSide.defender,
								battleType, 
								state, 
								accumulations, 
								options,
							);

							
							

							var delayedSpend = {
								attacker: attackerDelayedSpend,
								defender: defenderDelayedSpend,
							}

							

							var polesToAdd = {
								attacker:{
									name: 'barrage',
									shortType: 'AFB',
								},
							
								defender:{
									name: 'barrage',
									shortType: 'AFB',
								}
							};

							
							
							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, undefined, polesToAdd, delayedSpend, accumulations, game.ThrowType.Barrage, battleType,  options, elapsedMili);

							
							
							

							return outcome;
						}

						state.timing ="announceRetreat";
						break;
					
					case "announceRetreat":
						var forceAttackerRetreat = false;

						if (!state.flags.attacker.some(obj => obj.name == 'announce') && !state.flags.defender.some(obj => obj.name == 'announce')  && battleType === 'Space'){

							if (state.resources.defender.rout && state.resources.defender.rout.total > 0 && !forceAttackerRetreat && !options.attacker.retreat && !options.attacker.notRetreat && battleType === game.BattleType.Space){
								state.resources.defender.rout.total -= 1;
								forceAttackerRetreat = true;
							}

							if ((options.defender.retreat ||  options.defender.ralnelCommander || options.defender.feint) && !options.defender.notRetreat && battleType === game.BattleType.Space){
								var output = oneSide(game.BattleSide.defender,game.BattleSide.attacker);
								if (output !== undefined){
									return output
								}
								
								
							} else if ((options.attacker.retreat || forceAttackerRetreat || options.attacker.ralnelCommander || options.attacker.feint) && !options.attacker.notRetreat && battleType === game.BattleType.Space){
								var output = oneSide(game.BattleSide.attacker, game.BattleSide.defender);
								if (output !== undefined){
									return output
								}
							}
						}
						

						

						function oneSide(battleSide, otherSide){
							everRetreat=true;
							state.retreat = battleSide;

							
							
							

							if (options[battleSide].ralnelCommander || options[battleSide].feint){

								var deadUnits = {
									attacker : [],
									defender : []
								}

								var didRetreatEarly = state[battleSide].some(obj => obj.retreatEarly);
									
								

								var count = 0;
								for (var k=0; k < state[battleSide].length && count < 2; k++){
									const unit = state[battleSide][k];
									if (!unit.retreated && !unit.isDamageGhost && !unit.notActiveSystem && (unit.move !== undefined || didRetreatEarly || options[battleSide].feint) &&
										
										((didRetreatEarly && unit.retreatEarly || (!didRetreatEarly)))){

										
										if ((!didRetreatEarly || unit.move !== undefined) && !options[battleSide].feint){
											count++;
										}

										unit.update({retreated:true});

										if (unit.ghostCorporeal){
											unit.ghostCorporeal.update({retreated:true});
										}

										
										if (unit.abilities.includes('ralnelFlagship')){
										
											for (var i = 0; i < state[otherSide].length; i++){
												const oppUnit = state[otherSide][i];
												if ((!oppUnit.sustainDamage || oppUnit.lostSustain) && !oppUnit.invisible && !oppUnit.immune && !oppUnit.isDamageGhost && oppUnit.typeShip){
													
													deadUnits[otherSide].push(state[otherSide].splice(i,1)[0]);
													
													break;
												}
											}
										}
									}	
								}

								if (deadUnits.attacker.length > 0 || deadUnits.defender.length > 0){

									var reward = {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0};

									
									
									var [transitionArray, newStatesArray, , rewardsArray]=resolveDead2(state, deadUnits.attacker, deadUnits.defender, reward, battleType, options, {startKey: true});

									for (const newState of newStatesArray){
										newState.flags[battleSide].push({
											name: 'announce',
											shortType: 'ART',
											duration: 1,
										});
										
									}

									
									
									return [transitionArray, newStatesArray, rewardsArray,  false];

									
								}




							}

							if (state.resources[otherSide].intercept?.total > 0){
								state.flags[battleSide].push({
									name: 'intercept',
									shortType: 'INC',
									duration: 1,
								});
								state.resources[otherSide].intercept.total -= 1;
							}


							state.flags[battleSide].push({
								name: 'announce',
								shortType: 'ART',
								duration: 1,
							});
						}

						state.timing = "combatRolls";
						break;
					
					case "combatRolls":

						// print(state.resources.attacker);
						// print(state.attacker);

						if (!state.flags.attacker.some(obj => obj.name == 'combatRolls')){

							



							var attackerThun = state.resources.attacker.nomadAgent?.total > 0;
							var defenderThun = state.resources.defender.nomadAgent?.total > 0;

							var attackerTransitions3DNoThun = [[[1]]];
							var attackerDelayedSpendThun = {};
							

							const [attackerTransitions3D,attackerDelayedSpend] = computeFleetTransitionsWrapper(
								state.attacker,
								state.defender,
								game.ThrowType.Battle,
								game.BattleSide.attacker,
								battleType,
								state,
								accumulations,
								options,
								false,
								defenderThun,
							)
							if (defenderThun){
								[attackerTransitions3DNoThun,attackerDelayedSpendThun] = 
								computeFleetTransitionsWrapper(
								state.attacker,
								state.defender,
								game.ThrowType.Battle,
								game.BattleSide.attacker,
								battleType,
								state,
								accumulations,
								options,
								)
							}

							 


							
							var defenderTransitions3DNoThun = [[[1]]];
							var defenderDelayedSpendThun = {};
							

							const [defenderTransitions3D,defenderDelayedSpend] = computeFleetTransitionsWrapper(
								state.defender,
								state.attacker,
								game.ThrowType.Battle,
								game.BattleSide.defender,
								battleType,
								state,
								accumulations,
								options,
								false,
								attackerThun,
							)
							
							if (attackerThun){
								[defenderTransitions3DNoThun,defenderDelayedSpendThun] = computeFleetTransitionsWrapper(
								state.defender,
								state.attacker,
								game.ThrowType.Battle,
								game.BattleSide.defender,
								battleType,
								state,
								accumulations,
								options,
								)
							}


							

							
							


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
							var polesToAdd = {};

							var delayedSpend = {
								attacker: attackerDelayedSpend,
								defender: defenderDelayedSpend,
							}

							var delayedSpendThun = {
								attacker: attackerDelayedSpendThun,
								defender: defenderDelayedSpendThun,
							}

							

							outcome = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, polesToAdd, delayedSpend, accumulations, game.ThrowType.Battle, battleType,  options, elapsedMili, {
								attackerTransitions3DNoThun: attackerTransitions3DNoThun,defenderTransitions3DNoThun: defenderTransitions3DNoThun,
								delayedSpendThun: delayedSpendThun
							});

							

							
							return outcome;

						}
						state.timing = 'retreat';
						break;

					case "retreat":

						if (!state.flags.attacker.some(obj => obj.name == 'retreat')) {


							state.flags.attacker.push({
								name: 'retreat',
								shortType: 'RT',
								duration: 1,
							})
							state.flags.defender.push({
								name: 'retreat',
								shortType: 'RT',
								duration: 1,
							})

							var transitionArray = [1];
							var newStatesArray = [];
							var rewardsArray = [accumulations];

							var exitInfo = undefined;

							
							



							

							var opponentRetreat = game.BattleSide.opponent(state.retreat);
							var alreadyRetreated = false;

							if (state.retreat && fleetLength(state[state.retreat]) > 0 && fleetLength(state[opponentRetreat]) > 0  && !options[state.retreat].notRetreat && battleType === game.BattleType.Space && !state.flags[state.retreat].some(obj => obj.name === 'intercept')){
								alreadyRetreated = true;

								var deadUnits = {
									attacker : [],
									defender : []
								}

								for (const unit of state[state.retreat]){
									if (!unit.retreated && !unit.notActiveSystem){
										unit.update({retreated:true});
										if (unit.abilities.includes('ralnelFlagship')){
											
											for (var i = 0; i < state[opponentRetreat].length; i++){
												const oppUnit = state[opponentRetreat][i];
												if ((!oppUnit.sustainDamage || oppUnit.lostSustain) && !oppUnit.invisible && !oppUnit.immune && !oppUnit.isDamageGhost && oppUnit.typeShip){
													
													deadUnits[opponentRetreat].push(state[opponentRetreat].splice(i,1)[0]);
													
													break;
												}
											}
										}
									}
								}
								

								if (deadUnits.attacker.length > 0 || deadUnits.defender.length > 0){

									var reward = {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0};
									
									[transitionArray, newStatesArray, , rewardsArray]=resolveDead2(state, deadUnits.attacker, deadUnits.defender, reward, battleType, options, {startKey: true});

									
								}
								

							}

							if (infiniteCondition){
								
							
								if (alreadyRetreated){
									exitInfo = [newStatesArray, rewardsArray,transitionArray];

								} else {

									var [attackerClone,defenderClone,flagsClone] = cloneFleetsAndFlags(state.attacker,state.defender,state.flags);
									var resClone = resourcesClone(state.resources);
									var polesClone = resourcesClone(state.poles);

									var exitStateReward = {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0};


									var usedState = {
										attacker: attackerClone,
										defender: defenderClone,
										timing: state.timing,
										resources: resClone,
										flags: flagsClone,
										poles: polesClone,

										prob: state.prob,
										startKey: buildStateKey(attackerClone, defenderClone, resClone, flagsClone, polesClone),
										
										turn: state.turn,
										terminal: false,
										retreat: game.BattleSide.attacker,
										notParticipating: state.notParticipating,
									}

									opponentRetreat = game.BattleSide.opponent(usedState.retreat);

									if (usedState.retreat && fleetLength(usedState[opponentRetreat]) > 0 && !options[usedState.retreat].notRetreat && battleType === game.BattleType.Space && !usedState.flags[usedState.retreat].some(obj => obj.name === 'intercept')){

										var deadUnits = {
											attacker : [],
											defender : []
										}
										
										for (const unit of usedState[usedState.retreat]){
											if (!unit.retreated && !unit.notActiveSystem){
												unit.update({retreated:true});
												
												if (unit.abilities.includes('ralnelFlagship')){
											
													for (var i = 0; i < usedState[opponentRetreat].length; i++){
														const oppUnit = usedState[opponentRetreat][i];
														if ((!oppUnit.sustainDamage || oppUnit.lostSustain) && !oppUnit.invisible && !oppUnit.immune && !oppUnit.isDamageGhost && oppUnit.typeShip){
															
															deadUnits[opponentRetreat].push(usedState[opponentRetreat].splice(i,1)[0]);
															
															break;
														}
													}
												}
											}

										}

										if (deadUnits.attacker.length > 0 || deadUnits.defender.length > 0){
									
											var [exitTransitions, exitStates, , exitRewards]=resolveDead2(usedState, deadUnits.attacker, deadUnits.defender, exitStateReward, battleType, options, {startKey: true});

											exitInfo = [exitStates, exitRewards,exitTransitions];

										} else {

											exitInfo = [[usedState], [exitStateReward],[1]];
										}
										
										
									} else {
										var dead = usedState.attacker;
										usedState.attacker = [];
										// print(usedState);
										var [exitTransitions, exitStates, , exitRewards]= resolveDead2(usedState, dead, [], exitStateReward, battleType, options, {startKey: true});

										exitInfo = [exitStates, exitRewards,exitTransitions];

										
									}
								}
								
							}

							return [transitionArray, newStatesArray, rewardsArray,  false, exitInfo];

							
						}

						

						

						state.timing = 'endOfRound';
						break;
						

					case "endOfRound":

						

						var output = abilityPassing(state, battleType, accumulations);
						if (output){

							return output;
						}

						state.timing = 'cleanup';						
						break;
					case "cleanup":
					

						
						accumulations.rounds++;
						

						markDamagedNotThisRound(state.attacker);
						markDamagedNotThisRound(state.defender);

						state.retreat = false;

						
						// for (var flag of state.flags.attacker) {
						// 	if (flag.duration > 0){
						// 		flag.duration--;
						// 	}
						// }
						// state.flags.attacker = state.flags.attacker.filter(flag => flag.duration !== 0);

						// for (var flag of state.flags.defender) {
						// 	if (flag.duration > 0){
						// 		flag.duration--;
						// 	}
						// }
						state.flags.defender = state.flags.defender.filter(flag => flag.duration !== 0);

						for (let i = state.flags.attacker.length - 1; i >= 0; i--) {
							const flag = state.flags.attacker[i];
							if (flag.duration > 0) {
								flag.duration--;
							}
							if (flag.duration === 0) {
								if (flag.unitPointer){
									const idx = flag.unitPointer.flagPointers.indexOf(flag)
									flag.unitPointer.flagPointers.splice(idx,1);
								}
								state.flags.attacker.splice(i, 1);
							}
						}

						for (let i = state.flags.defender.length - 1; i >= 0; i--) {
							const flag = state.flags.defender[i];
							if (flag.duration > 0) {
								flag.duration--;
							}
							if (flag.duration === 0) {
								if (flag.unitPointer){
									const idx = flag.unitPointer.flagPointers.indexOf(flag)
									flag.unitPointer.flagPointers.splice(idx,1);
								}
								state.flags.defender.splice(i, 1);
							}
						}
						

						state.terminal = (fleetLength(state.attacker) === 0 || fleetLength(state.defender) === 0);
						if (state.terminal){
							state.attacker = state.attacker.filter(obj => !obj.leaveEarly);
							state.defender = state.defender.filter(obj => !obj.leaveEarly);

							// if (fleetLength(state.attacker)=== 0){
							// 	state.attacker = []
							// }
							// if (fleetLength(state.defender)=== 0){
							// 	state.defender = []
							// }
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

				// if (exitMap.has(startState.startKey)) {
				// 	return exitMap.get(startState.startKey);
				// }

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
							meta: { newKey, transitions, newStates, rewards },
							
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

					exitState: undefined,
					exitStateReward: undefined,
					
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

						var exitInfo = undefined;
						var tempExitInfo = undefined;
						

						// let tempExit;

						

						

						let limit = 100;



						for (let i = 0; i < limit; i++) {
								
							[transitions, newStates, rewards, done, tempExitInfo] = runState(state, accumulation, elapsedMili);
							

							if (tempExitInfo !== undefined && exitInfo === undefined && infiniteCondition){

								
								
								exitInfo = tempExitInfo;
								

								
							}
							
							
							
							if (transitions[0] < 0.99999) {
								done = true;
							}
							if (done) break;

							if (i >= limit-1){
								print('state loop limit reached ERROR ERROR');
								break;
							}
						}
						
						
						

						// if (state.terminal){
						// 	print(state);
						// }
						

						// compute final key for this processed state (this matches original)
						const newKey = buildStateKey(state.attacker, state.defender, state.resources, state.flags, state.poles);

						

						// Insert mapping into explorationMap now (prevents cycles from recursing).
						if (!explorationMap.has(state.startKey)) {
							explorationMap.set(state.startKey, [newKey, accumulation]);
						}

						if (exitInfo !== undefined && !exitMap.has(state.startKey) && infiniteCondition){
							exitMap.set(state.startKey, [exitInfo[0].map(obj => obj.startKey), exitInfo[1],exitInfo[2]]);
						}

						
						if (exitInfo !== undefined && infiniteCondition){
							for (const exitState of exitInfo[0]){
								if (!explorationMap.has(exitState.startKey)){
									stack.unshift({ state: exitState, stage: 'enter', hypothetical: true});
								}
							}
						}

						

						
						if (states.has(newKey)) {
							
							continue;
						}

						
						const simplifiedState = {
							attacker: state.attacker?.map(a => ({ shortType: a.shortType, survived: a.invisible && a.immune })) || [],
							defender: state.defender?.map(d => ({ shortType: d.shortType, survived: d.invisible && d.immune })) || [],
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
								
								stack.push({ state: child, stage: 'enter'});
							}
							
						}

						
						var next = {
							state: state, // mutated final-state object (we need newStates, transitions, rewards)
							stage: 'finish',
							meta: { newKey, transitions, newStates, rewards },
							
						}
						

						
						
						

						stack.push(next);

					} else if (frame.stage === 'finish') {
						// finalize the simplifiedState using data from meta
						const { newKey, transitions, newStates, rewards } = frame.meta;
						const simplifiedState = states.get(newKey);
						if (!simplifiedState) {
							simplifiedState = {
								attacker: frame.state.attacker?.map(a => ({ shortType: a.shortType })) || [],
								defender: frame.state.defender?.map(d => ({ shortType: d.shortType })) || [],
								resources: frame.state.resources,
								rewards: [],
								nextStates: [],
								terminal: frame.state.terminal,
								prob: frame.state.prob,
								transitionArray: [],
								
								
							}
							states.set(newKey, simplifiedState);
						
						}

						var stateIndexMap= new Map();
						
						if (infiniteCondition){
							simplifiedState.nextExits = [];
							simplifiedState.exitRewards = [];
							simplifiedState.exitTransitions = [];

							var stateIndexMapExit = new Map();

							
						}
						for (let i = 0; i < newStates.length; i++) {
							const child = newStates[i];
							const transition = transitions[i];
							const reward = rewards[i];

							// simplifiedState.rewards.push(reward);
							

							// The child's mapping must exist now (either it pre-existed or we processed it in the stack)
							const [childKey, nextAccumulation] = explorationMap.get(child.startKey);
							


							if (infiniteCondition){
								
							
								

								const check = exitMap.get(child.startKey);

								if (check !== undefined){
									var [childKey2temps, exitRewards, exitTransitions] = check;

									for (var j = 0; j < childKey2temps.length; j++){
										var check2 = explorationMap.get(childKey2temps[j]);

										if (check2 !== undefined){
											var endKey = check2[0];
											var endAcc = check2[1];
											var tempReward = combineAccumulations(reward, exitRewards[j])
											tempReward = combineAccumulations(tempReward,endAcc);
											
											var str = endKey + JSON.stringify(tempReward);
											if (stateIndexMapExit.has(str)) {
												const idx = stateIndexMapExit.get(str);
									
												simplifiedState.exitTransitions[idx] += (transition * exitTransitions[j]);
											} else {

												stateIndexMapExit.set(str, simplifiedState.exitTransitions.length)
												
												simplifiedState.nextExits.push(endKey);
												simplifiedState.exitRewards.push(tempReward);
												simplifiedState.exitTransitions.push(transition * exitTransitions[j]);

											}

											
										} else {
											print('error error error, exit state was never explored')
										}


									}
									 
								} else {

									var tempReward = combineAccumulations(reward,nextAccumulation);
									var str = childKey + JSON.stringify(tempReward);
									
									
									if (stateIndexMapExit.has(str)) {
										const idx = stateIndexMapExit.get(str);
										simplifiedState.exitTransitions[idx] += transition;
									} else {

										stateIndexMapExit.set(str, simplifiedState.exitTransitions.length)

										simplifiedState.nextExits.push(childKey);
										simplifiedState.exitRewards.push(tempReward)
										simplifiedState.exitTransitions.push(transition);

										
									}
								}
							}

							

							if (typeof childKey === 'undefined') {
								
								simplifiedState.nextStates.push(null);
								simplifiedState.rewards.push(null);
								simplifiedState.transitionArray.push(transition);
							} else {

								
								var tempReward = combineAccumulations(reward,nextAccumulation);
								var str = childKey + JSON.stringify(tempReward);
								if (stateIndexMap.has(str)) {
									const idx = stateIndexMap.get(str);
						
									simplifiedState.transitionArray[idx] += (transition);
								} else {

									stateIndexMap.set(str, simplifiedState.transitionArray.length)
									
									simplifiedState.nextStates.push(childKey);
									simplifiedState.rewards.push(combineAccumulations(reward,nextAccumulation));
									simplifiedState.transitionArray.push(transition);

								}
								
							}
						}
					}
				} // end while stack

				// return mapping now (as original reduceState did)
				return explorationMap.get(startState.startKey);
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
				poles: {
					attacker: {},
					defender: {}
				},
				startKey: buildStateKey(attacker, defender, resources, flags, this.poles),
				timing: 'beforeEverything',
				prob: 1,
				turn: 'attacker',
				
				
				
				terminal: false,
				retreat: false,
				notParticipating: {
					attacker: cloneFleet(attackerNotParticipating),
					defender: cloneFleet(defenderNotParticipating),
				}

				
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
			// console.log(exitMap);

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





			function forceUnwinnableToDefault(states, nonTerminals, terminals) {
				
				

				// Build reverse adjacency: for each nextKey, list predecessors
				const predecessors = new Map(); // nextKey -> Array of parent keys
				for (let i = 0; i < nonTerminals.length; ++i) {
					const key = nonTerminals[i];
					const st = states.get(key);
					if (!st || !st.nextStates) continue;
					const ns = st.nextStates;
					const ta = st.transitionArray;
					if (!ta) continue;
					for (let j = 0; j < ns.length; ++j) {
						const p = ta[j];
						// Skip zero or near-zero transitions
						if (p <= 0 || !isFinite(p)) continue;
						const nextKey = ns[j];
						let arr = predecessors.get(nextKey);
						if (!arr) {
							arr = [];
							predecessors.set(nextKey, arr);
						}
					arr.push(key);
					}
				}

				// Mark all states that can reach a terminal by walking predecessors from terminals
				const canReachTerminal = new Set();
				const queue = [];
				for (let t = 0; t < terminals.length; ++t) {
					const tk = terminals[t];
					if (!canReachTerminal.has(tk)) {
					canReachTerminal.add(tk);
					queue.push(tk);
					}
				}

				// BFS on reverse graph
				for (let qi = 0; qi < queue.length; ++qi) { // use index-based loop for speed (no shift())
					const cur = queue[qi];
					const preds = predecessors.get(cur);
					if (!preds) continue;
					for (let p = 0; p < preds.length; ++p) {
						const pred = preds[p];
						if (!canReachTerminal.has(pred)) {
							canReachTerminal.add(pred);
							queue.push(pred);
						}
					}
				}

				// Any nonTerminal that is NOT in canReachTerminal is "impossible to win" -> force to default terminal
				
				for (let i = 0; i < nonTerminals.length; ++i) {
					const key = nonTerminals[i];
					const state = states.get(key);
					if (!canReachTerminal.has(key)) {
						const s = states.get(key);
						s.nextStates = s.nextExits;
						s.rewards = s.exitRewards;
						s.transitionArray = s.exitTransitions;
						// for (var j = 0; j < s.nextExitsTemp.length; j++){
						// 	var [a,b] = explorationMap.get(s.nextExitsTemp[j]);
						// 	print('trigger')

						// 	s.nextStates.push(a);
						// 	s.rewards.push(combineAccumulations(b,s.exitRewardsTemp[j]));
						// 	s.transitionArray.push(s.exitTransitionsTemp[j]);
							
						// 	// if (s.nextExits[j] !== null){
						// 	// 	s.nextStates[j] = s.nextExits[j];
						// 	// 	s.rewards[j] = s.exitRewards[j];
						// 	// 	s.transitionArray[j] = s.exitTransitions[j];
						// 	// }
						// }
						
						
						
						
					}
				}
			}

			if (infiniteCondition){
				forceUnwinnableToDefault(states, nonTerminals, terminals);
			}

			// console.log(states);
			

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
						
						combineAccumulationsMutate(finalAccumulations, state.rewards[j], prob * state.transitionArray[j]);
						

						
					}
				}

				// print(Array.from(states.entries())
				// .filter(([_, value]) => true)
				// .map(([key, value]) => [key, value]));
				// print(finalAccumulations);

			}
			print(it);
			print('done calc!');

			

			

			var finalAttacker = attacker.map(function (unit) {
				return [unit.shortType];
			});
			var finalDefender =defender.map(function (unit) {
				return [unit.shortType];
			});

			var finalAttackerSurvived = attacker.map(function (unit) {
				return [unit.shortType];
			});
			var finalDefenderSurvived = defender.map(function (unit) {
				return [unit.shortType];
			});

			



			var result = new structs.EmpiricalDistribution();
			var resultSurvived = new structs.EmpiricalDistribution();

			
			for (var i = 0; i < terminals.length; ++i){
				const key = terminals[i];
				const state = states.get(key);

				const stateAttacker = state.attacker.filter(obj => !obj.survived);
				const stateDefender = state.defender.filter(obj => !obj.survived);

				const stateAttackerSurvived = state.attacker.filter(obj => obj.survived);
				const stateDefenderSurvived = state.defender.filter(obj => obj.survived);

				
				
				
				
				if (stateAttacker.length != 0) {
					result.increment(-stateAttacker.length, state.prob);
					for (var a = 0; a < stateAttacker.length; a++) {
						if (!finalAttacker[a])
							finalAttacker[a] = [];
						if (finalAttacker[a].indexOf(stateAttacker[a].shortType) < 0)
							finalAttacker[a].push(stateAttacker[a].shortType);
					}
				} else if (stateDefender.length !== 0) {
					result.increment(stateDefender.length, state.prob);
					for (var d = 0; d < stateDefender.length; d++) {
						if (!finalDefender[d])
							finalDefender[d] = [];
						if (finalDefender[d].indexOf(stateDefender[d].shortType) < 0)
							finalDefender[d].push(stateDefender[d].shortType);
					}
				} else
					result.increment(0, state.prob);

				if (stateAttackerSurvived.length != 0 && everRetreat) {
					resultSurvived.increment(-stateAttackerSurvived.length, state.prob);
					for (var a = 0; a < stateAttackerSurvived.length; a++) {
						if (!finalAttacker[a])
							finalAttacker[a] = [];
						if (finalAttacker[a].indexOf(stateAttackerSurvived[a].shortType) < 0)
							finalAttacker[a].push(stateAttackerSurvived[a].shortType);

						

					}
				} else if (stateDefenderSurvived.length !== 0 && everRetreat) {
					resultSurvived.increment(stateDefenderSurvived.length, state.prob);
					for (var d = 0; d < stateDefenderSurvived.length; d++) {
						if (!finalDefender[d])
							finalDefender[d] = [];
						if (finalDefender[d].indexOf(stateDefenderSurvived[d].shortType) < 0)
							finalDefender[d].push(stateDefenderSurvived[d].shortType);
					}
				} else if (everRetreat)
					resultSurvived.increment(0, state.prob);
			}

			
			
			return [[result, finalAttacker, finalDefender], [resultSurvived, finalAttackerSurvived, finalDefenderSurvived], finalAccumulations];
		}

		
		



		
		



		





		



			



		






		

		





		











		
























		





		

		function getBoostAndSpecialFunctions(Fleet, opponentFleet, throwType, crown, delayedSpend, battleSide, battleType,  state, accumulation, options, raw = false, afraid = false){

			var fleet = Fleet.filter(obj => !obj.invisible);

			var specials = function (unitIn) {
					return false;
				};
			
			if (!raw){
				for (const flag of state.flags[battleSide]){
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
			
			for (const flag of state.flags[battleSide]){
				
				const rollBoost = activeRollBoosts[flag.name];
				
				if (rollBoost){
					
					// print(flag)
					
					const output = rollBoost.apply(flag.unitPointer, battleType, throwType, options[battleSide]);
					if (rollBoost.singleUnit){
						rollBoostChoseUnit.push(compose(basicUnitFunction,output));
					} else {
						
						rollBoosts=compose(rollBoosts, output);
					}
					
				}

				const boost = activeBoosts[flag.name];
				
				if (boost){
					const output = boost.apply(flag.unitPointer, battleType, throwType, options[battleSide]);
					if (boost.singleUnit){
						boostChoseUnit.push(compose(basicUnitFunction,output));
					} else {
						boosts=compose(boosts, output);
					}
					
				}

				
				const reroll = activeRerolls[flag.name];

				if (reroll){
					const output = reroll.apply(flag.unitPointer, battleType, throwType, options[battleSide]);
					rerolls=compose(rerolls, output);
				}
				
				

			}

			for (const passive of passiveRollBoosts){
				// print(passive);
				// print(thisSideOptions);
				// print(passive.condition(fleet, opponentFleet, battleSide, battleType,thisSideResources,thisSideFlags, thisSideOptions));
				if (passive.condition(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid)){
					
					
					const output = passive.apply(battleType, throwType, delayedSpend, options[battleSide]);
					if (passive.singleUnit){
						rollBoostChoseUnit.push(compose(basicUnitFunction,output))
					} else {
						rollBoosts=compose(rollBoosts, output);
					}
				}
			}

			for (const passive of passiveBoosts){
				if (passive.condition(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid)){
					const output = passive.apply(battleType, throwType, delayedSpend, options[battleSide]);
					if (passive.singleUnit){
						boostChoseUnit.push(compose(basicUnitFunction,output))
					} else {
						boosts=compose(boosts, output);
					}
				}
			}
			
			for (const passive of passiveRerolls){
				if (passive.condition(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid)){
					const output = passive.apply(battleType, throwType, delayedSpend, options[battleSide]);
					rerolls=compose(rerolls, output);

					
				}
			}
			
			}

			if (state.resources[battleSide].meld?.total > 0){
				// thisSideResources.meld.total -= 1;
				rollBoostChoseUnit.push('meld');
			}

			var meldTargets =  function (unitIn) {
								return false;
							};
			

			

			
			function getExpected(unit, boost, rollBoost, meld){


				
				const fakeFleet = [unitToFakeUnit(unit, throwType, composeBool(meldTargets,meld), compose(boosts,boost), compose(rollBoosts,rollBoost), rerolls, false, options[battleSide])];
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
			var bonus10 = raw ? false : thisSideOptions.crownOfThalnosN;
			var jolnar = raw ? false: unit.abilities.includes('jolnarFlagship') && throwType === game.ThrowType.Battle;
			var immuneCrown = unit.type === undefined;
			var special = raw ? false : specialUnitFunction(unit);
			var useMeld = meldFunction(unit);

			var argent = raw ? false: (throwType === game.ThrowType.Barrage && unit.abilities.includes("argentDestroyerII"));
			
			
			
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
					argent: argent,
			}
			return fakeUnit;
		}




		

		function computeFleetTransitionsWrapper(fleet, opponentFleetFull, throwType, battleSide, battleType, state, accumulation, options, raw=false, potentialThundarian=false){

			var delayedSpend = {};

			var filteredFleet = fleet.filter(obj => !obj.passive && obj[game.ThrowValues[throwType]] > 0);

			var otherSide = game.BattleSide.opponent(battleSide);

			const crown = raw ? false : options[battleSide].crownOfThalnos && throwType === game.ThrowType.Battle && !state.resources[otherSide].warFunding?.total > 0;
			const plasma = raw ? false : (options[battleSide].plasmaScoringN || state.poles[battleSide].plasmaScoringNOwns !== undefined) && (throwType === game.ThrowType.Barrage || throwType === game.ThrowType.Bombardment || throwType === game.ThrowType.SpaceCannon);
			var hacans = 0;
			if (state.resources[battleSide].tgs && !raw && !potentialThundarian){
				hacans = Math.min(fleet.reduce(
				(sum, obj) => sum + (obj.abilities.includes("hacanFlagship") ? 1 : 0), 0
				), state.resources[battleSide].tgs.total);
			}


			

			
			

			

			const [boostFunction, boostRollFunction, rerollFunction, meldFunction, specialUnitFunction] = getBoostAndSpecialFunctions(filteredFleet, opponentFleetFull, throwType, crown, delayedSpend,  battleSide, battleType, state, accumulation, options, raw, potentialThundarian);

			
			

			const fakeFleet=[];
			var totalDice=0;
			var meldUnit;
			for (const unit of filteredFleet) {
				const fakeUnit = unitToFakeUnit(unit, throwType, meldFunction, boostFunction, boostRollFunction, rerollFunction, specialUnitFunction, options[battleSide], raw);
				fakeFleet.push(fakeUnit);
				totalDice += fakeUnit.dice;
				if (potentialThundarian){
					fakeUnit.meld = false;
				}
				if (fakeUnit.meld){
					meldUnit = fakeUnit;
				}



			}
			
			var meldUses = 0;
			if (meldUnit &&
				plasma && 
				totalDice <= 1 && 
				!meldUnit.bonus10 && !meldUnit.jolnar && 
				((meldUnit.battleValue-hacans)<=7 || (crown && meldUnit.immuneCrown && (meldUnit.battleValue-hacans-1)<=7) )){

					meldUnit.meld=false;
			} else if (meldUnit) {
				delayedSpend.meld = delayedSpend.meld ? delayedSpend.meld + 1 : 1;
			}
			
			const output = exact(fakeFleet, crown, plasma, hacans);
			
			return [output,delayedSpend];

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
			if (N === 0) return [[[1]]];

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




		

		function getSpaceCannonTransition(fleetFull, opponentFleetFull, battleSide, battleType, state, accumulation, options) {

		
			
			var otherSide = game.BattleSide.opponent(battleSide);

			if (options[otherSide].solarFlare && state.timing === "spaceCannonOffense") return [[[[1]]],{}];

			function useSpaceCannon(unit) {
				return unit.spaceCannonDice !== 0 && 
				!unit.lostSpaceCannon && 
				!unit.notUseSpaceCannon && 
				(!options[otherSide].entropicScar || unit.type === undefined) &&
				(!unit.notActiveSystem || ((unit.abilities.includes("deepSpaceCannon")||options[battleSide].trine) && state.timing === "spaceCannonOffense"));
			}

			
			
			var spaceCannonFleet = fleetFull.filter(useSpaceCannon);

			if (fleetFull.some(obj => obj.abilities.includes('ralnelDestroyer') || obj.abilities.includes('ralnelDestroyerII'))){
				var destroyers = fleetFull.filter(obj => (obj.abilities.includes('ralnelDestroyer') || obj.abilities.includes('ralnelDestroyerII')) && obj.presentSpace && !obj.notUseSpaceCannon).sort(
					(a,b) =>  b.galvanized - a.galvanized
				);
				
				var structures = fleetFull.filter(obj => obj.typeStructure && obj.presentSpace && !obj.lostSpaceCannon).sort(
					(a,b) =>  (b.spaceCannonDice * (11-b.spaceCannonValue)) - (a.spaceCannonDice * (11-a.spaceCannonValue))
				);
				
				
				if (destroyers.length > 0 && structures.length > 0){
					
					var structureIdx=0
					for (const destroyer of destroyers){
						if (destroyer.abilities.includes('ralnelDestroyerII')){
							const unit = fastShallowCloneUnit(destroyer);
							unit.spaceCannonDice = structures[0].spaceCannonDice;
							unit.spaceCannonValue = structures[0].spaceCannonValue;
							spaceCannonFleet.push(unit)
						} else if (destroyer.abilities.includes('ralnelDestroyer') && structureIdx < structures.length){
							const unit = fastShallowCloneUnit(destroyer);
							unit.spaceCannonDice = structures[structureIdx].spaceCannonDice;
							unit.spaceCannonValue = structures[structureIdx].spaceCannonValue;
							spaceCannonFleet.push(unit);
							structureIdx += 1;
						}
						
					}
				}
			}

			if (options[battleSide].experimental && state.timing === "spaceCannonOffense" && battleType === game.BattleType.Space){
				const lowest = fleetFull.reduce((best, obj) => {
					if (obj.type === game.UnitType.SpaceDock && !obj.notUseSpaceCannon && !obj.lostSpaceCannon && (!best || (obj.spaceCannonDice * (11-obj.spaceCannonValue)) < (best.spaceCannonDice * (11-best.spaceCannonValue)))) {
						return obj;
					}
					return best;
					}, undefined);
				if (lowest){
					const index = spaceCannonFleet.indexOf(lowest);
					print(spaceCannonFleet)

					const unit = fastShallowCloneUnit(lowest);
					unit.spaceCannonDice = 3;
					unit.spaceCannonValue = 5;

					
					if (index !== -1){
						spaceCannonFleet.splice(index,1);
					} 
					
					spaceCannonFleet.push(unit)
				}

			}

			if (spaceCannonFleet.length === 0) return [[[[1]]],{}];

			var output = computeFleetTransitionsWrapper(
					spaceCannonFleet, 
					opponentFleetFull, 
					game.ThrowType.SpaceCannon,
					battleSide,
					battleType,
					state,
					accumulation,
					options,
				)
			
			
			return output;

		}

		function getBombardmentTransition(fleetFull, opponentFleetFull, battleSide, battleType, state, accumulation, options) {

		
			var otherSide = game.BattleSide.opponent(battleSide);
			function useBombardment(unit) {
				return unit.bombardmentDice !== 0 && !unit.lostBombardment && !unit.notUseBombardment && (!options[otherSide].entropicScar || unit.type === undefined);
			}
			
			var bombardmentFleet = fleetFull.filter(useBombardment);

			var planetary = opponentFleetFull.some(obj => 
				obj.planetaryShield && obj.presentPlanet && !obj.lostPlanetaryShield && !obj.notUsePlanetaryShield);
			// noBombardment=false;

			

			if (bombardmentFleet.length === 0 || planetary || options[otherSide].conventions) return [[[[1]]],{}];
			
			var output = computeFleetTransitionsWrapper(
					bombardmentFleet, 
					opponentFleetFull, 
					game.ThrowType.Bombardment,
					battleSide,
					battleType,
					state,
					accumulation,
					options,
				)
			
			
			return output;

		}

		function getBarrageTransition(fleetFull, opponentFleetFull, battleSide, battleType, state, accumulation, options) {

			
			var otherSide = game.BattleSide.opponent(battleSide);
			function useBarrage(unit) {
				return unit.barrageDice !== 0 && !unit.lostBarrage && !unit.notUseBarrage && (!options[otherSide].entropicScar || unit.type === undefined);
			}
			
			var barrageFleet = fleetFull.filter(useBarrage);

			if (options[battleSide].voidArmaments && checkTiming(state.timing, 'barrage')){
				barrageFleet.push({
					type: undefined,
					barrageValue: 6,
					barrageDice: 3,
					abilities: [],
				})
			}

			if (barrageFleet.length === 0) return [[[[1]]],{}];
			
			var output = computeFleetTransitionsWrapper(
					barrageFleet, 
					opponentFleetFull, 
					game.ThrowType.Barrage,
					battleSide,
					battleType,
					state,
					accumulation,
					options,
				)

			

		
			
			return output;

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

			// print([dim1A, dim2A, dim3A, dim1B,dim2B, dim3B])

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
				'blueMech': {
					
					timing: 'beforeEverything',
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						// print(unit);
						
						return true;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){

						const otherSide = game.BattleSide.opponent(battleSide);

						const fakeState = {
							attacker: state.attacker,
							defender: state.defender,
							resources: state.resources,
							flags: state.flags,
							poles: state.poles,
							timing: 'combatRolls',
							prob: 0,

							terminal: state.terminal,
							retreat: state.retreat,
							notParticipating: state.notParticipating,

						}

						var bestUnit = undefined;
						var bestDiff = -100;

						for (const unitTemp of state[battleSide]){
							if (unitTemp.capacity !== undefined && !unitTemp.notActiveSystem){
								const fakeUnit = fastShallowCloneUnit(unitTemp)
								var output = computeFleetTransitionsWrapper([fakeUnit], fakeState[otherSide], game.ThrowType.Battle, battleSide, battleType, fakeState, accumulation, options);
								var x0= expectedHits(output[0]);

								fakeUnit.battleDice += 1;
								output = computeFleetTransitionsWrapper([fakeUnit], fakeState[otherSide], game.ThrowType.Battle, battleSide, battleType, fakeState, accumulation, options);
								var x1= expectedHits(output[0]);

								if (x1 - x0 > bestDiff){
									bestUnit = unitTemp;
									bestDiff = x1 - x0;
								}
							}
						}

						// const lowest = state[battleSide].reduce((best, obj) => {
						// 	if (obj.battleValue && obj.battleDice > 0 && (!best || obj.battleValue < best.battleValue)){
						// 		return obj;
						// 	}
						// 	return best
						// }, undefined)
						
						

						const flag = {
							name: 'blueMech',
							shortType: 'BM',
							duration: -1,
							unitPointer: null,
							side: battleSide,
							unitSide: battleSide,
						};
						
						state.flags[battleSide].push(flag);
						unit.flagPointers.push(flag);

						if (bestUnit){
							bestUnit.flagPointers.push(flag);
							flag.unitPointer = bestUnit;
							bestUnit.update({importance : bestUnit.importance + 1})
						}
						
						
						

						
						


						function expectedHits(probs, hitDims = [0, 1], indices = []) {
							// Base case: innermost element (a probability value)
							if (typeof probs === 'number') {
								const totalHits = hitDims.reduce((sum, dim) => sum + (indices[dim] ?? 0), 0);
								return probs * totalHits;
							}

							// Recursive case: dive deeper into the array
							return probs.reduce(
								(sum, subArray, i) => sum + expectedHits(subArray, hitDims, [...indices, i]),
								0
							);
						}

						

					},
					priority:0,
				},

				'ralnelMech': {
					
					timing: 'endOfRound',
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						// print(unit);
						
						return !unit.invisible && battleType === game.BattleType.Ground && unit.presentPlanet;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){

						// print([unit, battleSide, battleType,  state, accumulation, options])
						
						

						const flag = {
							name: 'ralnelMech',
							shortType: 'RNM',
							duration: 1,
							unitPointer: null,
							side: battleSide,
							unitSide: battleSide,
						};
						
						state.flags[battleSide].push(flag);
						unit.flagPointers.push(flag);
						flag.unitPointer = unit;

						var count = 2;
						for (var i = 0; i < state[battleSide].length && count > 0; i ++){
							const unitTemp = state[battleSide][i];
							if (unitTemp.notActiveSystem && unitTemp.typeGroundForce && unitTemp.planet){
								unitTemp.update({notActiveSystem:false, immune:false, invisible:false, passive:false});
								if (unitTemp.abilities.includes('ralnelMech')){
									const flagTemp = {
										name: 'ralnelMech',
										shortType: 'RNM',
										duration: 1,
										unitPointer: null,
										side: battleSide,
									};
									state.flags[battleSide].push(flagTemp);
									unitTemp.flagPointers.push(flagTemp);
									flagTemp.unitPointer = unitTemp;
								}
								count -= 1;
							}
						}

					},
					

					

					

					


					
					priority:0,
				},
				'naazRokhaMechRepair': {
					
					timing: 'startOfRound',
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						return !unit.invisible;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){

						// print([unit, battleSide, battleType,  state, accumulation, options])
						

						const flag = {
							name: 'naazRokhaMechRepair',
							shortType: 'NRR',
							duration: 1,
							unitPointer: null,
							side: battleSide,
							unitSide: battleSide,
							
						};
						
						state.flags[battleSide].push(flag);
						unit.flagPointers.push(flag);
						flag.unitPointer = unit;

						// print(state.attacker);

						if (unit.damaged) {

							unit.update({damaged: false});

							if (unit.sustainDamage && !unit.lostSustain && !unit.notUseSustain){
								const sustain = unit.toDamageGhost()
								addUnit(state[battleSide], sustain, battleSide, battleType,  state, accumulation, options);
							}
						
						}

						// print(state.attacker);
						// print('')

					},
					

					

					

					


					
					priority: function(unit) {
						return unit.damaged ? 2 : -2;
					},
				},
				'mentakFlagship': {
					
					timing: 'beforeEverything_',
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						return !unit.notActiveSystem;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){

						
						const otherSide = game.BattleSide.opponent(battleSide);

						const flag = {
							name: 'mentakFlagship',
							shortType: 'MKF',
							duration: -1,
							unitPointer: null,
							side: otherSide,
							unitSide: battleSide,
							newUnitEffect: this.newUnitEffect,
							priority: this.priority,
						};
						
						state.flags[otherSide].push(flag);
						unit.flagPointers.push(flag);
						flag.unitPointer = unit;

						applyContinuousEffectsOnUnits(state[otherSide], otherSide, battleType,  state, accumulation, options);
					},
					

					

					terminate: function(unit, battleSide, battleType,  state, accumulation, options){
						// print('trigger')
						
						var otherSide = game.BattleSide.opponent(battleSide);

						for (const unit of state[otherSide]) {
							
							if (unit.typeShip){
								unit.update({notUseSustain: false});
							}
						}

						applyContinuousEffectsOnUnits(state[otherSide], otherSide, battleType,  state, accumulation, options);

						game.fillOutFleet(state[otherSide], battleType, options[otherSide]);

						return []
					
					},

					newUnitEffect: function(unit){

						if (unit.typeShip && !unit.notUseSustain){
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
					
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						return battleType === game.BattleType.Ground && unit.presentPlanet;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){
						

						const otherSide = game.BattleSide.opponent(battleSide);

						const flag = {
							name: 'mentakMech',
							shortType: 'MKM',
							duration: -1,
							unitPointer: null,
							side: otherSide,
							unitSide: battleSide,
							newUnitEffect: this.newUnitEffect,
							priority: this.priority,
						};
						
						state.flags[otherSide].push(flag);
						unit.flagPointers.push(flag);
						flag.unitPointer = unit;

						applyContinuousEffectsOnUnits(state[otherSide], otherSide, battleType,  state, accumulation, options);
					},
					terminate: function(unit, battleSide, battleType,  state, accumulation, options){

						var otherSide = game.BattleSide.opponent(battleSide);
						
						for (const unit of state[otherSide]) {
							if (unit.typeGroundForce){
								unit.update({notUseSustain: false});
							}
						}

						applyContinuousEffectsOnUnits(state[otherSide], otherSide, battleType,  state, accumulation, options);

						game.fillOutFleet(state[otherSide], battleType, options[otherSide]);
					
					},
					newUnitEffect: function(unit){

						if (unit.typeGroundForce && !unit.notUseSustain){
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

				'nekroFlagship': {
					
					timing: 'startOfCombat',
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						return unit.presentSpace && battleType===game.BattleType.Space && state.poles[battleSide].nekroFlagship === undefined;

						// && !(state.flags[battleSide].some(item => item.name === 'nekroFlagship'));
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){

						
						const otherSide = game.BattleSide.opponent(battleSide);

						state.poles[battleSide].nekroFlagship = 'NKF';

						for (const unitTemp of state[battleSide]){
							if (unitTemp.typeGroundForce && unitTemp.immune && unitTemp.invisible && unitTemp.passive && !unitTemp.notActiveSystem){
								unitTemp.update({typeShip: true, immune: false, passive: false, invisible:false})
							}
						}
						
						

						applyContinuousEffectsOnUnits(state[battleSide], battleSide, battleType,  state, accumulation, options);

						game.fillOutFleet(state[battleSide], battleType, options[battleSide]);
					},
					

					

					
					


					
					priority:10,
				},

				'purpleMech': {
					
					timing: 'beforeCombat',
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						return battleType===game.BattleType.Space && state.poles[battleSide].purpleMechSpace === undefined;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){

						
						

						state.poles[battleSide].purpleMechSpace = 'skip';

						for (const unitTemp of state[battleSide]){
							if (unitTemp.abilities.includes('purpleMech') && unitTemp.invisible && unitTemp.immune && unitTemp.passive){
								unitTemp.update({typeShip: true, immune: false, passive: false, invisible:false})
							}
						}
						
						

						applyContinuousEffectsOnUnits(state[battleSide], battleSide, battleType,  state, accumulation, options);

						game.fillOutFleet(state[battleSide], battleType, options[battleSide]);
					},
					

					

					
					


					
					priority:0,
				},

				'crimsonFlagship': {
					
					timing: 'beforeEverything_',
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						return !unit.notActiveSystem && options[battleSide].activeBreach;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){

						
						const otherSide = game.BattleSide.opponent(battleSide);

						const flag = {
							name: 'crimsonFlagship',
							shortType: 'CRF',
							duration: -1,
							unitPointer: null,
							side: otherSide,
							unitSide: battleSide,
							newUnitEffect: this.newUnitEffect,
							priority: this.priority,
						};
						
						state.flags[otherSide].push(flag);
						unit.flagPointers.push(flag);
						flag.unitPointer = unit;
						
						applyContinuousEffectsOnUnits(state[otherSide], otherSide, battleType,  state, accumulation, options);
					},
					

					

					terminate: function(unit, battleSide, battleType,  state, accumulation, options){
						
						
						var otherSide = game.BattleSide.opponent(battleSide);

						for (const unit of state[otherSide]) {
							
							
							unit.update({notUseUnitAbilities: false});
							
						}
						// print('trigger2')
						// applyContinuousEffectsOnUnits(state[otherSide], otherSide, battleType,  state, accumulation, options);

						// game.fillOutFleet(state[otherSide], battleType, options[otherSide]);
						
						return []
					
					},

					newUnitEffect: function(unit){

						
						if (!unit.notUseUnitAbilities){
							unit.update({notUseUnitAbilities: true});
						}

						if (unit.isDamageGhost){

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
					
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						return battleType === game.BattleType.Space && !unit.notActiveSystem && !unit.notParticipatingWhilePresent;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){
						

						const flag = {
							name: 'l1z1xFlagship',
							shortType: 'L1F',
							duration: -1,
							unitPointer: null,
							side: battleSide,
							unitSide: battleSide,
						};
						
						state.flags[battleSide].push(flag);
						unit.flagPointers.push(flag);

						flag.unitPointer = unit;
					},
					
					priority:0,
				},
				'empyreanFlagship': {
					
					timing: 'beforeEverything_',
					
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						return true;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){
						

						const flag = {
							name: 'empyreanFlagship',
							shortType: 'EMF',
							duration: -1,
							unitPointer: null,
							side: battleSide,
							unitSide: battleSide,
						};
						
						state.flags[battleSide].push(flag);
						unit.flagPointers.push(flag);

						flag.unitPointer = unit;
					},
					
					priority:0,
				},
				'sardakkFlagship': {
					
					timing: 'beforeEverything_',
					
					condition: function(unit, battleSide, battleType,  state, accumulation, options){
						return !unit.notActiveSystem;
					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){
						

						const flag = {
							name: 'sardakkFlagship',
							shortType: 'SNF',
							duration: -1,
							unitPointer: null,
							side: battleSide,
							unitSide: battleSide,
						};
						
						state.flags[battleSide].push(flag);
						unit.flagPointers.push(flag);

						flag.unitPointer = unit;
					},
					
					priority:0,
				},
				'nomadMech': {
					
					timing: 'duringCombat',
					
					condition: function(unit, battleSide, battleType,  state, accumulation, options){

						

						return unit.presentSpace && checkFleet(state[battleSide], obj => obj.typeShip) && !unit.damaged && unit.sustainDamage && !unit.lostSustain && !unit.notUseSustain && !unit.isDamageGhost;


					},
					effect: function(unit, battleSide, battleType,  state, accumulation, options){

						const sustain = unit.toDamageGhost();
						
						sustain.update({immune:true, damageCorporeal:undefined});

						const flag = {
								name: 'nomadMech',
								shortType: 'NOM',
								duration: -1,
								unitPointer: null,
								side: battleSide,
							};
						sustain.flagPointers.push(flag);
						if (addUnit(state[battleSide], sustain, battleSide, battleType,  state, accumulation, options)){
							

							state.flags[battleSide].push(flag);
							
							flag.unitPointer = sustain;
							
						}
						

						unit.flagPointers.push(flag);

						

						
						
					},
					
					priority:0,
				},


				

				
				
			};
		}

		function initPassiveContinuousAbilities(){
			return [
				{
					name: 'articlesOfWar',
					timing: '_',
					condition: function(battleSide, battleType,  state, accumulation, options){

						return options[battleSide].articlesOfWar;
					},
					newUnitEffect: function(unit, battleSide, battleType,  state, accumulation, options){
						
						// not an elegant solution, would need to be updated if new printed mech abilities don't fall in these camps
						if (unit.type === game.UnitType.Mech){
							
							const stockBase = window.fluidCanon(options[battleSide].unitsCanon, state.poles[battleSide],  options[battleSide])[unit.type]._baseStats;

							const updates = {};
							
							if (stockBase.bombardmentValue){
								updates.lostBombardment = true;
							}
							if (stockBase.spaceCannonValue){
								updates.lostSpaceCannon = true;
							}
							if (stockBase.barrageValue){
								updates.lostBarrage = true;
							}
							if (stockBase.planetaryShield){
								updates.lostPlanetaryShield = true;
							}

							if (stockBase.typeShip){
								updates.typeShip = false;
							}
							if (stockBase.typeGroundForce){
								updates.typeGroundForce = false;
							}
							if (stockBase.typeStructure){
								updates.typeStructure = false;
							}
							
							updates.abilities = unit.abilities.filter(obj => !stockBase.abilities.includes(obj))


								
							
							
							unit.update(updates);

							
							
						}

						
						

						return true;
					
					},
					priority: 1,
				},
				{
					name: 'blitz',
					timing: 'beforeEverything',
					condition: function(battleSide, battleType,  state, accumulation, options){

						return options[battleSide].blitz && battleType === game.BattleType.Ground;
					},
					newUnitEffect: function(unit){
						
						
						if (unit.typeShip && unit.type !== game.UnitType.Fighter && !unit.notActiveSystem && (unit.bombardmentValue === undefined || unit.lostBombardment)){
							unit.update({bombardmentValue: 6, bombardmentDice: 1});
						}

						
						

						return true;
					
					},
					priority: 0,
				},
				{
					name: 'crimsonFlagshipWeaken',
					timing: 'beforeEverything_',
					condition: function(battleSide, battleType,  state, accumulation, options){

						return options[battleSide].crimsonFlagshipWeaken;
					},
					newUnitEffect: function(unit, battleSide, battleType,  state, accumulation, options){
						
						
						if (!unit.notActiveSystem){
							unit.update({notUseUnitAbilities: true});
						}

						if (unit.isDamageGhost){

							if (unit.damageCorporeal){
								unit.damageCorporeal.ghostCorporeal=undefined;
							}
							
							return false;
						};

						return true;
					
					},
					priority: -1,
				},
				{
					name: 'disable',
					timing: 'beforeEverything_',
					condition: function(battleSide, battleType,  state, accumulation, options){
						var otherSide = game.BattleSide.opponent(battleSide)
						return options[otherSide].disable;
					},
					newUnitEffect: function(unit, battleSide, battleType,  state, accumulation, options){
						
						
						if (!unit.notActiveSystem && unit.type === game.UnitType.PDS){
							unit.update({lostPlanetaryShield: true, lostSpaceCannon:true});
						}

						return true;
					
					},
					priority: -1,
				},
				{
					name: 'entropicScar',
					timing: 'beforeEverything_',
					condition: function(battleSide, battleType,  state, accumulation, options){

						return options[battleSide].entropicScar;
					},
					newUnitEffect: function(unit){
						
						
						if (!unit.notActiveSystem){
							unit.update({notUseUnitAbilities: true});
						}

						if (unit.isDamageGhost){

							if (unit.damageCorporeal){
								unit.damageCorporeal.ghostCorporeal=undefined;
							}
							
							return false;
						};
						

						return true;
					
					},
					priority: -1,
				},
				{
					name: 'mini',
					timing: 'beforeEverything_',
					condition: function(battleSide, battleType,  state, accumulation, options){

						return options[battleSide].abilities.mini;
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
					name: 'smotheringPresence',
					timing: '_',
					condition: function(battleSide, battleType,  state, accumulation, options){

						const otherSide = game.BattleSide.opponent(battleSide);
						

						return options[battleSide].smotheringPresenceWeaken || (options[otherSide].abilities.smotheringPresence || state.poles[otherSide].smotheringPresenceOwns !== undefined) && (checkFleet(state[otherSide], obj => obj.typeStructure) || checkFleet(state.notParticipating[otherSide], obj => obj.typeStructure));
					},
					newUnitEffect: function(unit, battleSide, battleType,  state, accumulation, options){
						
						
						if (!unit.notActiveSystem){
							unit.update({notUseUnitAbilities: true});
						}
						if (unit.isDamageGhost){

							if (unit.damageCorporeal){
								unit.damageCorporeal.ghostCorporeal=undefined;
							}
							
							return false;
						};
						return true;
					
					},
					priority: -1,
				},

				
				
				
				
				
				
			]
		}

		// most single use ability, resource abilities that only have 1 resource, don't have flag but would need flags if there were multiple resources
		function initActivations(){

			return [
				{
					name:'ambush',
					timing: 'startOfCombat',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						return (battleType === 'Space') && (options[battleSide].abilities.ambush) && state.poles[battleSide].ambush === undefined;
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){

						
						
						var thisSideOptions = options[battleSide];
						var otherSide = game.BattleSide.opponent(battleSide);

						
						var flagsToAdd = undefined;
						var polesToAdd = {};
							
						polesToAdd[battleSide] = {
							shortType: 'AM',
							name: 'ambush'
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
							
							// if (units.length === 0) return [[[[1]]],{}]
							
							

							
							const indices = expected.map((_, i) => i)
										.sort((a, b) => expected[b] - expected[a])
										.slice(0, 2);

							
							

							const outputIn = computeFleetTransitionsWrapper(
								indices.map(i => units[i]),
								state[otherSide], 
								game.ThrowType.Battle,
								battleSide,
								battleType,
								state,
								accumulation,
								options,
								true,
							)

							
							

							





							return outputIn;
							// return [[[1]], [[0]]];
						}

						if (battleSide === game.BattleSide.attacker) {
							var [attackerTransitions3D,attackerDelayedSpend]=createMentakTransitions(state[battleSide], options[battleSide]);
							
							var [defenderTransitions3D,defenderDelayedSpend] = [[[[1]]],{}];

						} else {

							var [defenderTransitions3D,defenderDelayedSpend]=createMentakTransitions(state[battleSide], options[battleSide]);
							
							var [attackerTransitions3D,attackerDelayedSpend] = [[[[1]]], {}];

						}



						var delayedSpend = {
							attacker: attackerDelayedSpend,
							defender: defenderDelayedSpend,
						}
						
						// print([attackerTransitions3D,  defenderTransitions3D]);
						// print(delayedSpend);
						
						
						const output = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, polesToAdd, delayedSpend, accumulation, undefined, battleType,  options, 0);

						

						
						// output[3] = true;
						

						return output;
					},
					priority: 1,
				},
				{
					name: 'assaultCannon',
					timing: 'startOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						
						return (battleType === 'Space') && (options[battleSide].assaultCannon) && state.poles[battleSide].assaultCannon === undefined && state[battleSide].filter(obj => obj.type !== game.UnitType.Fighter && !obj.notActiveSystem && obj.typeShip && !obj.invisible && !obj.isDamageGhost).length >= 3;
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						
						

						var otherSide = game.BattleSide.opponent(battleSide);
						var deadUnits = {
							attacker : [],
							defender : []
						}
						for (var i = state[otherSide].length - 1; i >= 0; i--){
							const unit = state[otherSide][i];
							if (unit.type !== game.UnitType.Fighter && unit.typeShip && !unit.isDamageGhost && !unit.invisible && !unit.immune){
								deadUnits[otherSide].push(state[otherSide].splice(i,1)[0]);
								break;
							}
						}

						if (deadUnits.attacker.length > 0 || deadUnits.defender.length > 0){
							var reward = {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0};

							var [transitionArray, newStatesArray, , rewardsArray]=resolveDead2(state, deadUnits.attacker, deadUnits.defender, reward, battleType, options, {startKey: true});

							for (const newState of newStatesArray){
								newState.poles[battleSide].assaultCannon = 'AC'; 
							}

							return [transitionArray, newStatesArray, rewardsArray,  false];

						} else {
							state.poles[battleSide].assaultCannon = 'AC';
						}



					},
					priority: 2,
				},
				{
					name:'dimensionalSplicer',
					timing: 'startOfCombat',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						return (battleType === game.BattleType.Space) && (options[battleSide].dimensionalSplicer || state.poles[battleSide].dimensionalSplicerOwns !== undefined) && 
						state.poles[battleSide].dimensionalSplicer;
						
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options, notParticipating){
						
						var otherSide = game.BattleSide.opponent(battleSide);

						
						// var flagsToAdd = undefined;
						var polesToAdd = {};
						polesToAdd[battleSide]= {
							name: 'dimensionalSplicer',
							shortType:'DSP'
						}

							
						var flagsToAdd = {};
						// flagsToAdd[battleSide] = {
						// 	name: 'dimensionalSplicer',
						// 	shortType: 'DSP',
						// 	duration: -1,
						// };

						
						

						var vector = [[[0]],[[1]]];
						// var vector = [[[0],[1]]]


						var attackerTransitions3D = battleSide === game.BattleSide.attacker ? vector : [[[1]]];
						var defenderTransitions3D = battleSide === game.BattleSide.defender ? vector : [[[1]]];

						var delayedSpend = {}

						var hitFunction =  function(unit){
							return true;
						}

						var AFB = 0;
						for (const unit of state[battleSide]){
							if (unit.barrageDice > 0){
								AFB += unit.barrageDice * clamp((11- unit.barrageValue)/10,0,1);
							}
						}
						// print(AFB)
						var fighterNumber = state[otherSide].filter(unit => unit.type === game.UnitType.Fighter).length;
						var killFighter = AFB < fighterNumber;
						var killSustain = state.resources[battleSide].directHit?.total > 0 || state.resources[battleSide].spark?.total > 0 || options[otherSide].nonEuclidean || state.poles[otherSide].nonEuclideanOwns !== undefined ;
						// killFighter=false;
						
						for (const unit of state[otherSide]){
							if (!unit.immune && (!unit.ghostCorporeal || killSustain) && (unit.type !== game.UnitType.Fighter || killFighter)){
								// print(unit)
								hitFunction = function(unitIn){
									
									return unitIn.label === unit.label;
								}
								break;
							}
						}
						// hitFunction = undefined;

						var attackerSoftPredicate = battleSide === game.BattleSide.defender ? hitFunction : undefined;
						var defenderSoftPredicate = battleSide === game.BattleSide.attacker ? hitFunction : undefined;
						

						
						
						
						const output = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, polesToAdd, delayedSpend, accumulation, game.ThrowType.Bombardment, battleType,  options, 0, {
							// attackerSpecialSoftPredicate: attackerSoftPredicate, 
							// defenderSpecialSoftPredicate: defenderSoftPredicate,
							attackerSoftPredicate: attackerSoftPredicate, 
							defenderSoftPredicate: defenderSoftPredicate
						});

						// print('done')

						// print(output);
						

						return output;
					},
					priority: 1,
				},
				{
					name: 'emergencyRepairs',
					timing: 'startOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){

						var condition = (state.resources[battleSide].emergencyRepairs?.total > 0)
						if (!condition){
							return false;
						}

						const damageable = state[battleSide].filter(obj => 
							!obj.invisible && !obj.immune && !obj.notUseSustain &&
							obj.sustainDamage && !obj.lostSustain);
						const damagedCount = damageable.filter(obj => obj.damaged).length;
						const damagableCount = damageable.length;

						
						//  && !(state.flags[battleSide].some(item => item.name === 'ERS'));
						if (options[battleSide].emergencyRepairsHalf){
							return damagedCount>=Math.ceil(damagableCount/2)
						} 
						if (options[battleSide].emergencyRepairsAll){
							return damagedCount>=damagableCount;
						}
						return damagedCount > 0;

						
						
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						state.resources[battleSide].emergencyRepairs.total -= 1;
						// state.flags[battleSide].push({
						// 	name: 'emergencyRepairsStart',
						// 	shortType: 'ERS',
						// 	duration: 1,
						// })
						

						for (var i = 0; i < state[battleSide].length; i++) {
							var unit = state[battleSide][i];

							if (unit.damaged && !unit.invisible && unit.sustainDamage && !unit.lostSustain) {
								unit.update({damaged: false});

								if (unit.sustainDamage && !unit.lostSustain && !unit.notUseSustain){
									const sustain = unit.toDamageGhost()
									addUnit(state[battleSide], sustain, battleSide, battleType,  state, accumulation, options);
								}							
							}
						}

					},
					priority: 0,
				},
				{
					name: 'emergencyRepairs',
					timing: 'endOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){

						var condition = (state.resources[battleSide].emergencyRepairs?.total > 0)
						if (!condition){
							return false;
						}

						// const damageable = state[battleSide].filter(obj => 
						// 	!obj.invisible && !obj.immune && !obj.notUseSustain &&
						// 	((obj.sustainDamage && !obj.lostSustain) || (options[battleSide].voidShielding && obj.type !== game.UnitType.Fighter && obj.typeShip)));
						const damageable = state[battleSide].filter(obj => 
							!obj.invisible && !obj.immune && !obj.notUseSustain &&
							obj.sustainDamage && !obj.lostSustain);
						const damagedCount = damageable.filter(obj => obj.damaged).length;
						const damagableCount = damageable.length;

						
						
						
						//  && !(state.flags[battleSide].some(item => item.name === 'ERS'));
						if (options[battleSide].emergencyRepairsHalf){
							return damagedCount>=Math.ceil(damagableCount/2)
						} 
						if (options[battleSide].emergencyRepairsAll){
							return damagedCount>=damagableCount;
						}
						return damagedCount > 0;

					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						state.resources[battleSide].emergencyRepairs.total -= 1;
						// state.flags[battleSide].push({
						// 	name: 'emergencyRepairsStart',
						// 	shortType: 'ERS',
						// 	duration: 1,
						// })
						

						for (var i = 0; i < state[battleSide].length; i++) {
							var unit = state[battleSide][i];

							if (unit.damaged && !unit.invisible) {
								unit.update({damaged: false});

								if (unit.sustainDamage && !unit.lostSustain && !unit.notUseSustain){
									const sustain = unit.toDamageGhost()
									addUnit(state[battleSide], sustain, battleSide, battleType,  state, accumulation, options);
								}							
							}
						}

					},
					priority: 0,
				},

				{
					name: 'fighterPrototype',
					timing: 'startOfCombat',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						
						return options[battleSide].fighterPrototype && state.poles[battleSide].fighterPrototype === undefined && battleType === game.BattleType.Space;
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						
						state.flags[battleSide].push({
							name: 'fighterPrototype',
							shortType: 'FP',
							duration: 1,
						})
						state.poles[battleSide].fighterPrototype = 'FP';
					},
					priority: -1,
				},

				{
					name: 'foresight',
					timing: 'beforeEverything',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						
						return options[battleSide].abilities.foresight && options[battleSide].useForesight && state.resources[battleSide].tgs?.total >= 3 && !options[battleSide].notRetreat && state.poles[battleSide].foresight === undefined && battleType === game.BattleType.Space;
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						
						for (const unit of state[battleSide]){
							if (!unit.notActiveSystem)
								unit.update({retreated: true});
						}

						

						state.poles[battleSide].foresight = 'FS';

						state.resources[battleSide].tgs.total -= 3;
						accumulation[battleSide].tgsSpent += 3;

						everRetreat = true;

					},
					priority: 0,
				},

				{
					name: 'foresightTF',
					timing: 'beforeEverything',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						
						return options[battleSide].abilities.foresightTF && !options[battleSide].notRetreat && state.poles[battleSide].foresightTF === undefined && battleType === game.BattleType.Space;
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						
						for (const unit of state[battleSide]){
							if (!unit.notActiveSystem)
								unit.update({retreated: true});
						}

						

						state.poles[battleSide].foresightTF = 'FSW';

						

						everRetreat = true;

					},
					priority: 0,
				},

				{
					name:'harrow',
					timing: 'endOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						return (battleType === game.BattleType.Ground) && (options[battleSide].abilities.harrow) && battleSide === game.BattleSide.attacker &&
						!(state.flags[battleSide].some(obj => obj.name === 'harrow'));
						
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options, notParticipating){
						
						var otherSide = game.BattleSide.opponent(battleSide)

						
						var flagsToAdd = undefined;
						var polesToAdd = {};
							
						var flagsToAdd = {};
						flagsToAdd[battleSide] = {
							name: 'harrow',
							shortType: 'HAR',
							duration: 1,
						};

						
						const filter = function(unit){
								return !unit.notActiveSystem && (unit.typeShip || (unit.abilities.includes('l1z1xMech') && (unit.notParticipatingWhilePresent || !unit.presentPlanet) && battleType === game.BattleType.Ground));
							}

						const attackerFull = state.attacker.concat(notParticipating.attacker).filter(filter);
						const defenderFull = state.defender.concat(notParticipating.defender);
						
						

						const [attackerTransitions3D, attackerDelayedSpend] = getBombardmentTransition(
							attackerFull, 
							defenderFull,
							battleSide, 
							battleType, 
							state, 
							accumulation, 
							options,
						);

						

						

						

						// return;


						var delayedSpend = {
							attacker: attackerDelayedSpend
						}
						const defenderTransitions3D = [[[1]]]

						
						
						
						const output = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, polesToAdd, delayedSpend, accumulation, game.ThrowType.Bombardment, battleType,  options, 0);

						
						

						return output;
					},
					priority: 1,
				},
				{
					name:'indoctrination',
					timing: 'startOfCombat',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						var otherSide = game.BattleSide.opponent(battleSide);

						

						return battleType === game.BattleType.Ground && (options[battleSide].abilities.indoctrination || state.poles[battleSide].indoctrinationOwns !== undefined) && 
						state.poles[battleSide].indoctrination === undefined && checkFleet(state[otherSide],obj => obj.type === game.UnitType.Infantry) && state.resources[battleSide].tgs?.total >= 2;
						
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options, notParticipating){

						print('trigger')
						
						var otherSide = game.BattleSide.opponent(battleSide);

						
						state.poles[battleSide].indoctrination = 'IND';

							
						

						for (let i = 0; i < state[otherSide].length; i++){
							const unit = state[otherSide][i];
							if (unit.type === game.UnitType.Infantry && !unit.invisible && !unit.immune){
								state[otherSide].splice(i,1);

								
								createUnits(game.UnitType.Infantry, 1, battleSide, battleType,  state, accumulation, options);

								state.resources[battleSide].tgs.total -= 2;
								accumulation[battleSide].tgsSpent += 2;

								return
								
							}
						}


						
						

						
					},
					priority: 1,
				},
				{
					name: 'mentakHero',
					timing: 'startOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){

						return state.poles[battleSide].mentakHero === undefined && battleType === game.BattleType.Space && options[battleSide].mentakHero;
						
						
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						
						state.poles[battleSide].mentakHero = 'MKH'
					},
					priority: 0,
				},

				{
					name: 'moraleBoost',
					timing: 'startOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						
						return (state.resources[battleSide].moraleBoost?.total > 0) && !(state.flags[battleSide].some(item => item.name === 'moraleBoost'));
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						state.resources[battleSide].moraleBoost.total -= 1;
						state.flags[battleSide].push({
							name: 'moraleBoost',
							shortType: 'MB',
							duration: 1,
						})
					},
					priority: -1,
				},

				{
					name: 'munitionsReserves',
					timing: 'startOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						
						return battleType === game.BattleType.Space && (state.resources[battleSide].tgs?.total >= 2) && (options[battleSide].abilities.munitionsReserves || state.poles[battleSide].munitionsReservesOwns) && !(state.flags[battleSide].some(item => item.name === 'munitionsReserves')) && (options[battleSide].munitionsReservesEveryRound || (options[battleSide].munitionsReservesOnceRound && state.poles[battleSide].munitionsReservesOnceRound === undefined));
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						state.resources[battleSide].tgs.total -= 2;
						accumulation[battleSide].tgsSpent += 2;
						state.flags[battleSide].push({
							name: 'munitionsReserves',
							shortType: 'MR',
							duration: 1,
						})
						state.poles[battleSide].munitionsReservesOnceRound = 'skip';
					},
					priority: -1,
				},

				{
					name: 'naazRokhaMech',
					timing: 'startOfCombat',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						
						

						return options[battleSide].units.naazRokhaMech && !options[battleSide].units.naazRokhaMechII && !options[battleSide].articlesOfWar && state[battleSide].some(obj => obj.type === game.UnitType.Mech && obj.spaceArea) && battleType === game.BattleType.Space && state.poles[battleSide].naazRokhaMechSpace === undefined;
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						
						

						state.poles[battleSide].naazRokhaMechSpace = 'NRM';

						for (const unit of state[battleSide]){
							if (unit.type === game.UnitType.Mech && unit.spaceArea && unit.invisible){
								unit.update({invisible:false, immune:false, passive:false});
							}
						}

						replaceUnit(state[battleSide], game.UnitType.Mech, battleSide, battleType,  state, accumulation, options);

						

					},
					priority: 3,
				},

				{
					name: 'orangeMech',
					timing: 'startOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){

						var condition = battleType === game.BattleType.Ground && options[battleSide].units.orangeMech && state.resources[battleSide].tgs?.total >= 3 && (options[battleSide].orangeMechRepairsOne || options[battleSide].orangeMechRepairsHalf || options[battleSide].orangeMechRepairsAll) && !options[battleSide].articlesOfWar;
						if (!condition){
							return false;
						}
						
						const damageable = state[battleSide].filter(obj => 
							!obj.invisible && !obj.immune && !obj.notUseSustain &&
							obj.sustainDamage && !obj.lostSustain && obj.type === game.UnitType.Mech);
						const damagedCount = damageable.filter(obj => obj.damaged).length;
						const damagableCount = damageable.length;

						
						if (options[battleSide].orangeMechRepairsOne){
							return damagedCount > 0;
						}
						if (options[battleSide].orangeMechRepairsHalf){
							return damagedCount>=Math.ceil(damagableCount/2)
						} 
						if (options[battleSide].orangeMechRepairsAll){
							return damagedCount>=damagableCount;
						}
						return false;

						
						
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						state.resources[battleSide].tgs.total -= 3;
						accumulation[battleSide].tgsSpent += 3;
						

						for (var i = 0; i < state[battleSide].length; i++) {
							var unit = state[battleSide][i];

							if (unit.damaged && !unit.invisible && unit.type === game.UnitType.Mech) {
								unit.update({damaged: false});

								if (unit.sustainDamage && !unit.lostSustain && !unit.notUseSustain){
									const sustain = unit.toDamageGhost()
									addUnit(state[battleSide], sustain, battleSide, battleType,  state, accumulation, options);
								}							
							}
						}

					},
					priority: 0,
				},

				

				{
					name:'proximaTargeting',
					timing: 'startOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						return (battleType === game.BattleType.Ground) && (options[battleSide].proximaTargeting || state.poles[battleSide].proximaTargetingOwns !== undefined) && 
						!(state.flags[battleSide].some(item => item.name === 'proximaTargeting')) &&
						checkFleet(state[battleSide], unit => unit.galvanized) && !options[battleSide].noProximaRoll;
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){

						
						
						// state.flags[battleSide].push({
						// 	name: 'proximaTargeting',
						// 	shortType: 'PT',
						// 	duration: 1,
						// })
						
						

						
						var otherSide = game.BattleSide.opponent(battleSide)

						
						
						var polesToAdd = {};
						// polesToAdd[battleSide] = {
						// 	name: 'proximaTargeting',
						// 	shortType: 'PT',
						// }
							
						var flagsToAdd = {};
						flagsToAdd[battleSide] = {
							name: 'proximaTargeting',
							shortType: 'PT',
							duration: 1,
						};

						var fakeFleet = [{
							type: undefined,
							bombardmentValue: 8,
							bombardmentDice: 3,
							abilities: [],
						}]

						
						

						const [mySideTransitions3D, mySideDelayedSpend] = getBombardmentTransition(
							fakeFleet, 
							state[otherSide], 
							battleSide, 
							battleType, 
							state, 
							accumulation, 
							options,
						);

						

						

						const [otherSideTransitions3D, otherSideDelayedSpend] = getBombardmentTransition(
							fakeFleet, 
							state[battleSide], 
							otherSide, 
							battleType, 
							state, 
							accumulation, 
							options,
						);

						// return;


						var delayedSpend = {}
						delayedSpend[battleSide] = mySideDelayedSpend;
						delayedSpend[otherSide] = otherSideDelayedSpend;
						
						
						const attackerTransitions3D = battleSide === game.BattleSide.attacker ? mySideTransitions3D : otherSideTransitions3D;

						const defenderTransitions3D = battleSide === game.BattleSide.defender ? mySideTransitions3D : otherSideTransitions3D;

						
						
						
						const output = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, polesToAdd, delayedSpend, accumulation, game.ThrowType.Bombardment, battleType,  options, 0);

						
						

						return output;
					},
					priority: 1,
				},

				{
					name:'proximaTargetingTF',
					timing: 'startOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						return (battleType === game.BattleType.Ground) && (options[battleSide].abilities.proximaTargetingTF || state.poles[battleSide].proximaTargetingTFOwns !== undefined) && 
						!(state.flags[battleSide].some(item => item.name === 'proximaTargetingTF')) && !options[battleSide].noProximaRoll;
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){

						
						
						// state.flags[battleSide].push({
						// 	name: 'proximaTargeting',
						// 	shortType: 'PT',
						// 	duration: 1,
						// })
						
						

						
						var otherSide = game.BattleSide.opponent(battleSide)

						
						
						var polesToAdd = {};
						// polesToAdd[battleSide] = {
						// 	name: 'proximaTargetingTF',
						// 	shortType: 'PTW',
						// }
							
						var flagsToAdd = {};
						flagsToAdd[battleSide] = {
							name: 'proximaTargetingTF',
							shortType: 'PTW',
							duration: 1,
						};
						
						var fakeFleet = [{
							type: undefined,
							bombardmentValue: 7,
							bombardmentDice: 3,
							abilities: [],
						}]

						
						

						const [mySideTransitions3D, mySideDelayedSpend] = getBombardmentTransition(
							fakeFleet, 
							state[otherSide], 
							battleSide, 
							battleType, 
							state, 
							accumulation, 
							options,
						);

						

						

						const [otherSideTransitions3D, otherSideDelayedSpend] = getBombardmentTransition(
							fakeFleet, 
							state[battleSide], 
							otherSide, 
							battleType, 
							state, 
							accumulation, 
							options,
						);

						// return;


						var delayedSpend = {}
						delayedSpend[battleSide] = mySideDelayedSpend;
						delayedSpend[otherSide] = otherSideDelayedSpend;
						
						
						const attackerTransitions3D = battleSide === game.BattleSide.attacker ? mySideTransitions3D : otherSideTransitions3D;

						const defenderTransitions3D = battleSide === game.BattleSide.defender ? mySideTransitions3D : otherSideTransitions3D;

						
						
						
						const output = matrixToStates(state, attackerTransitions3D,  defenderTransitions3D, flagsToAdd, polesToAdd, delayedSpend, accumulation, game.ThrowType.Bombardment, battleType,  options, 0);

						
						

						return output;
					},
					priority: 1,
				},

			

				{
					name: 'revealPrototype',
					timing: 'startOfRound',
					condition: function(_, battleSide, battleType,  state, accumulation, options){
						
						

						return options[battleSide].revealPrototype && state.poles[battleSide].revealPrototype === undefined && state.resources[battleSide].tgs?.total >= 4 &&
						Object.values(game.UnitType).some(unit => options[battleSide][`upgrade${unit}`])
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){
						state.poles[battleSide].revealPrototype = 'RP';

						
						for (const unitType in game.UnitType){
							
							if (options[battleSide][`upgrade${unitType}`] && state[battleSide].some(obj => !obj.invisible && obj.type === unitType && !obj.isDamageGhost)){
								
								const name = options[battleSide].unitsVersion[unitType].upgraded.name;
								if (name === undefined){
									continue
								}

								if (name === "standardUpgrade"){
									state.poles[battleSide][unitType] = 'skip';
								} else {
									
									state.poles[battleSide][name] = 'skip';
								}

								state.resources[battleSide].tgs.total -= 4;
								accumulation[battleSide].tgsSpent += 4;
								replaceUnit(state[battleSide], unitType, battleSide, battleType,  state, accumulation, options);

								

								return;

							}
						}

						
					},
					priority: -1,
				},

				{
					name: 'skilledRetreat',
					timing: 'startOfCombat',
					condition: function(_, battleSide, battleType,  state, accumulation, options){

						
						
						return options[battleSide].skilledRetreat && !options[battleSide].notRetreat && state.poles[battleSide].skilledRetreat === undefined && battleType === game.BattleType.Space;
					},
					effect: function(_, battleSide, battleType,  state, accumulation, options){

						
						
						for (const unit of state[battleSide]){
							if (!unit.notActiveSystem)
								unit.update({retreated: true});
						}

						

						state.poles[battleSide].skilledRetreat = 'SR';

						

						everRetreat = true;

					},
					priority: 0,
				},

			
				
				

				
				
				
				
				
				
				
				

				

				
			]
		}

		function initActiveBoosts(){

			return {

				'fighterPrototype': {
					apply: function (unit, battleType, throwType, sideOptions) {
						const output = 
							function (unitIn) {
								return (throwType === game.ThrowType.Battle) && (unitIn.type === game.UnitType.Fighter) ? 2 : 0;
							};
						return output;
							
					}
				},

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
					name: 'bunker',
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						
						return options.defender.bunker && battleType === game.BattleType.Ground && throwType === game.ThrowType.Bombardment;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						const output = -4;
							
						return output;
							
					}
				},
				{
					name: 'nebula',
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						
						return options[battleSide].nebula && battleSide === game.BattleSide.defender && battleType === game.BattleType.Space && throwType === game.ThrowType.Battle;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						const output = 
							function (unitIn) {
								return (unitIn.typeShip) ? 1 : 0;
							};
						return output;
							
					}
				},

				{
					name: 'planesplitter',
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						return options[battleSide].abilities.planesplitter && throwType === game.ThrowType.Battle;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						const output = 2;
						return output;
							
					}
				},

				{
					name: 'prophecyOfIxth',
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						return options[battleSide].prophecyOfIxth && throwType === game.ThrowType.Battle;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						const output = 
							function (unitIn) {
								return (unitIn.type === game.UnitType.Fighter) ? 1 : 0;
							};
						return output;
							
					}
				},
				{
					name: 'purpleMech',
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						return throwType === game.ThrowType.Battle;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						const output = 
							function (unitIn) {
								
								return unitIn.abilities.includes('purpleMech') ? sideOptions.nearbyAnomalies : 0;
							};
						return output;
							
					}
				},
				{
					name: 'superchargeTF',
					singleUnit: true,
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						return (options[battleSide].abilities.superchargeTF || state.poles[battleSide].superchargeTFOwns !== undefined) && throwType === game.ThrowType.Battle;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						const output = 
							function (unitIn) {
								return (unitIn.type !== undefined) ? 2 : 0;
							};
						return output;
							
					}
				},
				{
					name: 'unrelenting',
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						return (options[battleSide].abilities.unrelenting || state.poles[battleSide].unrelentingOwns !== undefined) && throwType === game.ThrowType.Battle;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						const output = 1;
						return output;
							
					}
				},

				
				
				
			]
		}

		function initActiveRollBoosts(){

			return {

				
				'blueMech': {
					apply: function (unit, battleType, throwType, sideOptions) {
						const output = 
							function (unitIn) {
								return (throwType === game.ThrowType.Battle) && (unitIn === unit) ? 1 : 0;
							};
						return output;
					}
				},
				
				

			}
		}
		function initPassiveRollBoosts(){
			return [
				
				{
					name: 'ambuscade',
					singleUnit: true,
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						
						// print(thisSideResources.ambuscade?.total > 0 && (throwType === game.ThrowType.Barrage || throwType === game.ThrowType.SpaceCannon || throwType === game.ThrowType.Bombardment) && !afraid)
						

						return state.resources[battleSide].ambuscade?.total > 0 && unitAbility(throwType) && !afraid;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						
						
						delayedSpend.ambuscade = delayedSpend.ambuscade ? delayedSpend.ambuscade + 1 : 1;
						
						const output = 
							function (unitIn) {
								return unitIn.type !== undefined ? 1 : 0;
							};
						return output;
					},
				},

				{
					name: 'argentCommander',
					singleUnit: true,
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						const output = checkFleet(fleet, obj => obj.type !== undefined) && (options[battleSide].argentCommander || state.poles[battleSide].argentCommanderOwns) && unitAbility(throwType);
						
						
						return output;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						
						const output = 
							function (unitIn) {
								return unitIn.type !== undefined ? 1 : 0;
							};
						return output;
					},
				},

				{
					name: 'plasmaScoring',
					singleUnit: true,
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, afraid){
						const output = checkFleet(fleet, obj => obj.type !== undefined) && (options[battleSide].plasmaScoring || state.poles[battleSide].plasmaScoringOwns) && (throwType === game.ThrowType.SpaceCannon || throwType === game.ThrowType.Bombardment);
						
						
						return output;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						
						const output = 
							function (unitIn) {
								return (unitIn.type !== undefined) ? 1 : 0;
							};
						return output;
					},
				},
				

			]
		}
		function initActiveRerolls(){

			return {

				'munitionsReserves': {
					apply: function (unit, battleType, throwType, sideOptions) {
						const output = (throwType === game.ThrowType.Battle) ? 1 : 0;
						return output;
					}
				},

			}
		}

		function initPassiveRerolls(){

			return [

				{
					name: 'fireTeam',
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, potentialThundarian){
						
						
						// var otherSide = game.BattleSide.opponent(battleSide);

						return state.resources[battleSide].fireTeam?.total > 0 && throwType === game.ThrowType.Battle && battleType === game.BattleType.Ground && !potentialThundarian;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						
						
						delayedSpend.fireTeam = delayedSpend.fireTeam ? delayedSpend.fireTeam + 1 : 1;
						
						const output = 
							function (unitIn) {
								return (unitIn.typeGroundForce) ? 1 : 0;
							};
						return output;
					},
				},

				{
					name: 'jolnarCommander',
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, potentialThundarian){
						
						// return (checkFleet(fleet, obj => obj.type !== undefined) && thisSideOptions.plasmaScoring);

						return (options[battleSide].jolnarCommander || state.poles[battleSide].jolnarCommanderOwns) && unitAbility(throwType);
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						
						
						const output = 
							function (unitIn) {
								return (unitIn.type !== undefined) ? 1 : 0;
							};
						return output;
					},
				},

				

				{
					name: 'warFunding',
					condition: function(fleet, throwType, battleSide, battleType, state, accumulation, options, potentialThundarian){
						
						// return (checkFleet(fleet, obj => obj.type !== undefined) && thisSideOptions.plasmaScoring);

						return state.resources[battleSide].warFunding?.total > 0 && throwType === game.ThrowType.Battle && !potentialThundarian;
					},
					apply: function (battleType, throwType, delayedSpend, sideOptions) {
						
						
						delayedSpend.warFunding = delayedSpend.warFunding ? delayedSpend.warFunding + 1 : 1;
						
						const output = 1;
						return output;
					},
				},
				

			]
		}


		function initCancelHits(){
			return [
				{
					name: 'maneuveringJets',
					timing: '_',
					condition: function(fleet, hits, simRemaining, thisSideLost, throwType, onceSet,  battleSide, battleType, state, accumulations, options){
						return (state.resources[battleSide].maneuveringJets?.total > 0) && hits > 0 && throwType === game.ThrowType.SpaceCannon && !onceSet.has(this.name);
					},
					effect: function(fleet, battleSide, battleType, state, accumulation, options){
						
						state.resources[battleSide].maneuveringJets.total -= 1;
						return [1,0, false]; // how many cancelled hits, and how many produced hits
					},
					priority: 6,
				},

				{
					name: 'nomadMech',
					timing: 'duringCombat_',
					condition: function(fleet, hits, simRemaining, thisSideLost, throwType, onceSet,  battleSide, battleType, state, accumulations, options){
						return state.flags[battleSide].some(item => item.name === this.name) && hits > 0 && (simRemaining === 0 || thisSideLost) && checkFleet(fleet, unit => unit.typeShip);
					},
					effect: function(fleet, battleSide, battleType, state, accumulation, options){
						const flagIndex = thisSideFlags.findIndex(obj => obj.name === this.name);

						const [flag] = thisSideFlags.splice(flagIndex,1);
						const unit = flag.unitPointer;

						fleet.splice(fleet.indexOf(unit),1);

						
						return sustainDamageEffect(unit, battleSide, battleType, state, accumulation, options);

					},
					priority: 1,
				},

				{
					name: 'proximaTargeting',
					timing: '_',
					
					condition: function(fleet, hits, simRemaining, thisSideLost, throwType, onceSet,  battleSide, battleType, state, accumulations, options){

						

						return (options[battleSide].proximaTargeting || state.poles[battleSide].proximaTargetingOwns !== undefined) && throwType === game.ThrowType.Bombardment && !onceSet.has(this.name);


					},
					effect: function(fleet, battleSide, battleType, state, accumulation, options){
						
						const cancels = fleet.filter(obj => !obj.invisible && obj.galvanized).length
						return [cancels,0, false]; // how many cancelled hits, and how many produced hits
					},
					priority: 10,
				},

				{
					name: 'proximaTargetingTF',
					timing: '_',
					
					condition: function(fleet, hits, simRemaining, thisSideLost, throwType, onceSet,  battleSide, battleType, state, accumulations, options){

						

						return (options[battleSide].abilities.proximaTargetingTF || state.poles[battleSide].proximaTargetingTFOwns !== undefined) && throwType === game.ThrowType.Bombardment && !onceSet.has(this.name);


					},
					effect: function(fleet, battleSide, battleType, state, accumulation, options){
						
						
						return [1,0, false]; // how many cancelled hits, and how many produced hits
					},
					priority: 10,
				},

				{
					name: 'shieldsHolding',
					timing: 'duringCombat_',
					condition: function(fleet, hits, simRemaining, thisSideLost, throwType, onceSet,  battleSide, battleType, state, accumulations, options){
						return (state.resources[battleSide].shieldsHolding?.total > 0) && hits > 0 && ((hits > 1 && simRemaining === 0) || thisSideLost) && battleType === 'Space' && !onceSet.has(this.name);
					},
					effect: function(fleet, battleSide, battleType, state, accumulation, options){
						
						state.resources[battleSide].shieldsHolding.total -= 1;
						return [2,0, false]; // how many cancelled hits, and how many produced hits
					},
					priority: 2,
				},

				{
					name: 'hardlight',
					timing: '_',
					condition: function(fleet, hits, simRemaining, thisSideLost, throwType, onceSet,  battleSide, battleType, state, accumulations, options){
						return (state.resources[battleSide].hardlight?.total > 0) && hits > 0 && ((hits > 1 && simRemaining === 0) || thisSideLost) && !onceSet.has(this.name);
					},
					effect: function(fleet, battleSide, battleType, state, accumulation, options){
						
						state.resources[battleSide].hardlight.total -= 1;
						return [2,0, false]; // how many cancelled hits, and how many produced hits
					},
					priority: 2,
				},
				
				

					
			]
		}

		function singularity(unit, battleSide, battleType,  state, accumulation, options, singularity, acronym){

			var find = Object.entries(options[battleSide].copy).find(([key, val]) => val === true && state.poles[battleSide][key.slice(0,-4)] === undefined);
			if (find === undefined){
				return [];
			}
			
			const otherSide = game.BattleSide.opponent(battleSide);
			
						
			entry = find[0].slice(0,-4);

			state.poles[battleSide][singularity] = acronym;
						
			if (entry in game.Technologies || entry in game.Abilities){
				state.poles[battleSide][entry+'Owns'] = 'skip';

				if (entry === 'smotheringPresence'){
					applyContinuousEffectsOnUnits(state[otherSide], otherSide, battleType,  state, accumulation, options)
				}
				
			} else {
				
				var unitType = undefined;
				var onlyAdd = false;
				if (entry.slice(-7,-1) === 'Abilit'){
					state.poles[battleSide][entry] = 'skip';
					entry = entry.slice(0,-7);
					unitType = game.UniqueUnits[entry].type;
					onlyAdd = true;

				} else if (entry in game.UniqueUnits){
					unitType = game.UniqueUnits[entry].type;

					state.poles[battleSide][entry] = 'skip';
				} else {
					
					entry = entry.charAt(0).toUpperCase() + entry.slice(1,-2);
					unitType = game.StandardUpgrades[entry].type;
					state.poles[battleSide][entry] = 'skip';

					
				}

				
				

				replaceUnit(state[battleSide], unitType, battleSide, battleType,  state, accumulation, options);
				
			}

			return [];

		}

		function initDeathEffects(){
			return [
				// {
				// 	name: 'yinFlagship',
				// 	timing: '_',
				// 	condition: function(unit, battleType, thisSideResources, thisSideOptions){
				// 		return unit.type === game.UnitType.Fighter;
				// 	},
				// 	deathEffect2: function(state, unit, battleSide, battleType, thisSideResources, thisSideOptions){
				// 		var transitionArray = [0.01,0.99];
				// 		var newStates = [];
				// 		var deadUnits = [];
				// 		for (var i = 0; i < transitionArray.length; i++){
							
				// 			var [attackerClone,defenderClone,flagsClone] = cloneFleetsAndFlags(state.attacker, state.defender, state.flags)
				// 			var resClone = resourcesClone(state.resources);

				// 			var deadAttacker = [];
				// 			var deadDefender = [];

				// 			if (i == 1){
								
								
				// 				// if (battleSide === game.BattleSide.attacker){
				// 				// 	deadDefender.concat(defenderClone);
				// 				// 	defenderClone = [];
				// 				// } else {
				// 				// 	deadAttacker.concat(attackerClone);
				// 				// 	attackerClone = [];
				// 				// }
				// 				deadDefender = deadDefender.concat(defenderClone);
				// 				defenderClone = [];
								
				// 				deadAttacker = deadAttacker.concat(attackerClone);
				// 				attackerClone = [];

				// 				// print(deadAttacker);
				// 				// print(attackerClone);
				// 			}

				// 			var newState = {
				// 				attacker: attackerClone,
				// 				defender: defenderClone,
				// 				resources: resClone,
				// 				flags: flagsClone,
				// 				startKey: undefined,
				// 				timing: state.timing,
				// 				prob: 0,
				// 				turn: state.turn,
				// 				
				// 				terminal: false,
				//				retreat: state.retreat
				// 			}
				// 			newStates.push(newState);
				// 			deadUnits.push([deadAttacker, deadDefender])
				// 		}
						

						
				// 		return [transitionArray, newStates, deadUnits];
				// 	},
				// 	priority: 1,
				// },

				{
					name: 'atomize',
					timing: '_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){

						return unitSide === battleSide && options[battleSide].atomize && unit.type === game.UnitType.Flagship && !unit.isDamageGhost;
						
					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){

						
							
						var [attackerClone,defenderClone,flagsClone] = cloneFleetsAndFlags(state.attacker, state.defender, state.flags)
						var resClone = resourcesClone(state.resources);
						var polesClone = resourcesClone(state.poles);
						var accClone = accumulationClone(accumulation);

						var newState = {
							attacker: [],
							defender: [],
							resources: resClone,
							flags: flagsClone,
							poles: polesClone,
							startKey: undefined,
							timing: state.timing,
							prob: 0,
							
							turn: state.turn,
							terminal: state.terminal,
							retreat: state.retreat,
							notParticipating: state.notParticipating,
						}

						var deadUnits = [attackerClone, defenderClone];

						return [[1], [newState], [deadUnits], [accClone]];

						
					},
					
					priority: 0,
					
				},
				{
					name: 'mentakHero',
					timing: 'duringCombat_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){
						var otherSide = game.BattleSide.opponent(battleSide);
						
						return state.poles[battleSide].mentakHero !== undefined && unit.typeShip && !unit.isDamageGhost && unitSide === otherSide;
						
					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){

						
						
						
						// print(state.poles[battleSide]);

						// var otherSide = game.BattleSide.opponent(battleSide);
						createUnits(unit.type, 1, battleSide, battleType, state, accumulation, options);
						
						// print(state[battleSide]);
						
						return [];

						
					},
					
					priority: -1,
					
				},

				

				{
					name: 'yinAgent',
					timing: 'duringCombat_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){
						
						
						return state.resources[battleSide].yinAgent?.total > 0 && !unit.isDamageGhost && unitSide === battleSide;
						

						

					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){

						state.resources[battleSide].yinAgent.total -= 1;
						
						var unitType = battleType === game.BattleType.Space ? game.UnitType.Fighter : game.UnitType.Infantry;
						
						createUnits(unitType, 2, battleSide, battleType, state, accumulation, options);
						
						
						
						return [];

						
					},
					
					priority: -1,
					
				},

				{
					name: 'singularity',
					timing: 'duringCombat_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){
						
						var otherSide = game.BattleSide.opponent(battleSide);

						var singularity = options[battleSide].abilities.singularity && state.poles[battleSide].singularity === undefined;

						return singularity && Object.values(options[battleSide].copy).some(val => val === true) && !unit.isDamageGhost && unitSide === otherSide;

					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){

						
						
						// const otherSide = game.BattleSide.opponent(battleSide);

						
						return singularity(unit, battleSide, battleType,  state, accumulation, options, 'singularity', 'SIN');
					},
					
					priority: 1,
					
				},
				{
					name: 'singularityX',
					timing: 'duringCombat_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){
						
						var otherSide = game.BattleSide.opponent(battleSide);

						var singularity = options[battleSide].abilities.singularityX && state.poles[battleSide].singularityX === undefined;

						return singularity && Object.values(options[battleSide].copy).some(val => val === true) && !unit.isDamageGhost && unitSide === otherSide;

					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){

						
						
						// const otherSide = game.BattleSide.opponent(battleSide);

						
						return singularity(unit, battleSide, battleType,  state, accumulation, options, 'singularityX', 'SINX');
					},
					
					priority: 1,
					
				},
				{
					name: 'singularityY',
					timing: 'duringCombat_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){
						
						var otherSide = game.BattleSide.opponent(battleSide);

						var singularity = options[battleSide].abilities.singularityY && state.poles[battleSide].singularityY === undefined;

						return singularity && Object.values(options[battleSide].copy).some(val => val === true) && !unit.isDamageGhost && unitSide === otherSide;

					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){

						
						
						// const otherSide = game.BattleSide.opponent(battleSide);

						
						return singularity(unit, battleSide, battleType,  state, accumulation, options, 'singularityY', 'SINY');
					},
					
					priority: 1,
					
				},
				{
					name: 'singularityZ',
					timing: 'duringCombat_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){
						
						var otherSide = game.BattleSide.opponent(battleSide);

						var singularity = options[battleSide].abilities.singularityZ && state.poles[battleSide].singularityZ === undefined;

						return singularity && Object.values(options[battleSide].copy).some(val => val === true) && !unit.isDamageGhost && unitSide === otherSide;

					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){

						
						
						// const otherSide = game.BattleSide.opponent(battleSide);

						
						return singularity(unit, battleSide, battleType,  state, accumulation, options, 'singularityZ', 'SINZ');
					},
					
					priority: 1,
					
				},
				{
					name: 'selfAssembly',
					timing: '_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){

						return unitSide === battleSide && (options[battleSide].selfAssembly || state.poles[battleSide].selfAssembly !== undefined) && unit.type === game.UnitType.Mech && !unit.isDamageGhost;
						
					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){
						

						accumulation[battleSide].tgsEarned += 1;
						

						
						return [];
					},
					
					priority: 0,
				},
				{
					name: 'courageous',
					timing: 'duringCombat_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){
						const otherSide = game.BattleSide.opponent(battleSide);

						return unitSide === battleSide && state.resources[battleSide].courageous?.total > 0 && battleType === game.BattleType.Space && unit.typeShip && !unit.isDamageGhost && checkFleet(state[otherSide],obj => obj.typeShip);

						
					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){
						

						var miss =  Math.max(Math.min((unit.battleValue - 1) / game.dieSides, 1), 0);
						var dice = [miss, 1-miss];
						var dice2 = [miss, 1-miss];
						if (state.resources[battleSide].meld?.total > 0){
							miss = getMeldMissFromBV(unit.battleValue);
							dice = [miss, 1-miss];
							state.resources[battleSide].meld.total -= 1;
						}

						state.resources[battleSide].courageous.total -= 1;

						var otherSide = game.BattleSide.opponent(battleSide);

						var transitionArray = slideMultiply(dice, dice2);
						var newStates = [];
						var deadUnits = [];
						var newAcc = [];
						for (var i = 0; i < transitionArray.length; i++){
							
							var [attackerClone,defenderClone,flagsClone] = cloneFleetsAndFlags(state.attacker, state.defender, state.flags)
							var resClone = resourcesClone(state.resources);
							var polesClone = resourcesClone(state.poles);

							var dead = [];

							var newState = {
								attacker: attackerClone,
								defender: defenderClone,
								resources: resClone,
								flags: flagsClone,
								poles: polesClone,
								startKey: undefined,
								timing: state.timing,
								prob: 0,
								
								turn: state.turn,
								terminal: state.terminal,
								retreat: state.retreat,
								notParticipating: state.notParticipating,
							}

							// var deadAttacker = [];
							// var deadDefender = [];

							var j = 0;
							for (var k = newState[otherSide].length-1; k >=0 && j < i; k--){
								const unit = newState[otherSide][k];
								
								if (unit.typeShip && !unit.isDamageGhost && !unit.invisible && !unit.immune){
									dead.push(unit);
									newState[otherSide].splice(k,1);
									j++;
								}
							}
						

							
							newStates.push(newState);

							var deadUnit = battleSide === game.BattleSide.attacker ? [[],dead] : [dead,[]];
							deadUnits.push(deadUnit)

							newAcc.push(accumulationClone(accumulation));
						}
						

						
						return [transitionArray, newStates, deadUnits, newAcc];
					},
					
					priority: function(unit) {
						const clamped = Math.max(1, Math.min(11, unit.battleValue));
						return 0 + 0.1*(9 - ((clamped - 1) / (11 - 1)) * 9);
					},
				},

				{
					name: 'lash',
					timing: '_',
					condition: function(unit, unitSide, battleSide, battleType,  state, accumulation, options){
						
						var otherSide = game.BattleSide.opponent(battleSide);
						return unitSide === battleSide && state.resources[battleSide].lash?.total > 0 && !unit.isDamageGhost && unit.cost !== undefined && checkFleet(state[otherSide],obj => obj.cost <= unit.cost);

						
					},
					destroyEffect: function(unit, battleSide, battleType,  state, accumulation, options){
						

						var otherSide = game.BattleSide.opponent(battleSide);
							
						var [attackerClone,defenderClone,flagsClone] = cloneFleetsAndFlags(state.attacker, state.defender, state.flags)
						var resClone = resourcesClone(state.resources);
						var polesClone = resourcesClone(state.poles);
						var accClone = accumulationClone(accumulation);

						var dead = [];

						var newState = {
							attacker: attackerClone,
							defender: defenderClone,
							resources: resClone,
							flags: flagsClone,
							poles: polesClone,
							startKey: undefined,
							timing: state.timing,
							prob: 0,
							
							turn: state.turn,
							terminal: state.terminal,
							retreat: state.retreat,
							notParticipating: state.notParticipating,
						}

						var dead = {
							attacker: [],
							defender: [],
						}

						
						for (var k = 0; k < newState[otherSide].length; k++){
							const unitTemp = newState[otherSide][k];
							
							if (unitTemp.cost <= unit.cost && !unitTemp.isDamageGhost && !unitTemp.immune && !unitTemp.invisible){
								dead[otherSide].push(newState[otherSide].splice(k,1)[0]);
								k--;
								break;
							}
						}
					

						
						var deadUnits = [dead.attacker, dead.defender];

						newState.resources[battleSide].lash.total -= 1;

						return [[1], [newState], [deadUnits], [accClone]];
					},
					
					priority: function(unit) {
						
						return 0 + (unit.cost || 0)/12
					},
				},


				
				

					
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

		function getMeldMissFromBV(bv){
			

			const miss = clamp((bv - 1)*(bv-2) / (2*game.dieSides**2),0,1);

			return miss

		}

		function clamp(value, min, max){
			return Math.min(max, Math.max(min, value));
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




		function checkFleet(fleet, rule){
			return fleet.some(obj => rule(obj) && !obj.invisible);
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