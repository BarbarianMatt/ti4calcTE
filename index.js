(function () {
	//console.trace();
	window.CanvasSizes = [
		{ width: 600, height: 400 },
		{ width: 900, height: 600 },
		{ width: 1200, height: 800 },
		{ width: 1800, height: 1200 },
	];

	var lastComputed;
	var input = getInput();

	
	

	input.computing = false;

	

	var recomputeHandler = {
		handler: 'recompute',
		deep: true,
	};

	var transientProperties = {
		costs: { attacker: { count: 0, cost: 0, }, defender: { count: 0, cost: 0, } },
		accumulation: {attacker:{tgsEarned:0, tgsSpent:0}, defender:{tgsEarned:0, tgsSpent:0}, rounds:0},
		showOptions: false,
		showHelp: false,
		computing: false,
		forceSlow: false, // do `app.forceSlow = true;` in developers console to force slow but robust calculation
		showBreakdown: false,
		


		
	};

	transientProperties.breakdown = {
		attacker: [], 
		defender: []
	};
	transientProperties.selectedUnit = null;      // currently selected unit object (reference)
	transientProperties.selectedSide = null;      // 'attacker' or 'defender'
	transientProperties.selectedIndex = null;
	transientProperties.showUnitModal = false;

	

	const SECTION_NAMES = [
		'maxSpend',
		'technologies',
		'abilities',
		'unitUpgrades',
		'genomes',
		
		'faction',
		'actionCards',
		'leaders',
		'battlefield',
		'promissory',
		
		'otherComponents',
		
	];

	transientProperties.SECTION_NAMES =  SECTION_NAMES;

	// Default section transient state. We create this once and merge into Vue data.
	const sectionState = {};
	SECTION_NAMES.forEach(s => {
		sectionState[s] = {
			exist: true,
			visible: true,    // whether the section is currently rendered (v-show should use this)
			collapsed: false, // whether the section is collapsed for animation/UI (caret etc.)
			_controller: null, // controller for animations/timers (was _controllers[name])
			// NOTE: add more per-section transient properties here if you need them later
		};
	});
	

	// Section visibility rules: functions that decide if a section should be present at all.
	// Return true => section should be shown (subject to collapsed), false => section removed entirely.
	// These are re-evaluated automatically (see applySectionRules) whenever reactive state changes.
	const sectionExistenceRules = {
		technologies: vm => !vm.twilightsFall, // technologies only exists when twilight's fall is false
		maxSpend: vm => true,
		faction: vm => true,
		actionCards: vm => true,
		leaders: vm => !vm.twilightsFall,
		genomes: vm => vm.twilightsFall,
		battlefield: vm => true,
		promissory: vm => !vm.twilightsFall,
		abilities: vm => !!vm.twilightsFall,
		unitUpgrades: vm => !!vm.twilightsFall,
		otherComponents: vm => true,
		};

	// Add the grouped sectionState into transientProperties
	transientProperties.sectionState = sectionState;

	// controller per section for timers / listeners so we can cancel on spam-click
	transientProperties._controllers = {};

	
	

	

	app = new Vue({
		el: '#root',
		data: Object.assign(input, transientProperties),
		methods: {



			


			applySectionRules() {
				const vm = this;
				if (!vm.sectionState) return;
				Object.keys(vm.sectionState).forEach(name => {
					const rule = sectionExistenceRules[name];
					const shouldExist = typeof rule === 'function' ? !!rule(vm) : true;
					const state = vm.sectionState[name];

					if (!shouldExist && state.exist) {
					// Remove immediately: cancel any controller/transition then mark not exist
					const ctrl = state._controller;
					if (ctrl && ctrl.transitionHandler && ctrl.bodyEl) {
						try { ctrl.bodyEl.removeEventListener('transitionend', ctrl.transitionHandler); } catch(e){}
					}
					(state._controller?.timers || []).forEach(t => clearTimeout(t));
					state._controller = null;

					state.visible = false;
					state.collapsed = false;
					state.exist = false;
					} else if (shouldExist && !state.exist) {
					state.exist = true;
					state.collapsed = false;
					state.visible = true;
					state._controller = null;
					}
				});
			},

			prettySectionName(name) {
				// insert a space before uppercase letters and capitalize first letter
				const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2');
				return spaced.charAt(0).toUpperCase() + spaced.slice(1);
				},

			getSectionItems(sectionName) {
			// fall back to empty array if section is missing
			return this[sectionName] && typeof this[sectionName] === 'function'
				? this[sectionName](SECTION_SOURCES[sectionName])   // call buildList function
				: this[sectionName] || [];
			},	

			

			

			// Replace your current toggleSection with this
			toggleSection(name) {
			if (!this.sectionState) this.sectionState = {};
			if (!this.sectionState[name]) {
				// ensure section exists
				this.$set(this.sectionState, name, { exist: true, visible: true, collapsed: false, _controller: null });
			}

			const state = this.sectionState[name];

			// Helper to normalize ref result (Element or array of Elements) -> single Element or null
			const normalizeRef = (refVal) => {
				if (!refVal) return null;
				if (Array.isArray(refVal)) {
				for (const candidate of refVal) {
					if (candidate && candidate.nodeType === 1) return candidate;
				}
				return null;
				}
				// single ref
				return (refVal && refVal.nodeType === 1) ? refVal : null;
			};

			// Cancel any ongoing transition for this section
			if (state._controller) {
				const ctrl = state._controller;
				try {
				if (ctrl.transitionHandler && ctrl.bodyEl) {
					ctrl.bodyEl.removeEventListener('transitionend', ctrl.transitionHandler);
				}
				} catch (e) { /* ignore */ }
				(ctrl.timers || []).forEach(t => clearTimeout(t));
				state._controller = null;
			}

			const isCollapsed = !!state.collapsed;

			if (isCollapsed) {
				// -------- OPEN --------
				this.sectionState[name].visible = true;
				this.$nextTick(() => {
				let body = this.$refs[`${name}Body`];
				body = normalizeRef(body);
				const items = this.$refs[`${name}Items`] || [];
				// if items ref is an array of arrays (v-for inside v-for) try to flatten/normalize length:
				const itemCount = Array.isArray(items) ? items.length : (items ? 1 : 0);

				if (!body) return;

				// Compute total duration based on per-item stagger
				const showStagger = 45;
				const itemAnimDuration = 260;
				const buffer = 20;
				const lastDelay = Math.max(0, (itemCount - 1) * showStagger);
				const totalDuration = lastDelay + itemAnimDuration + buffer;

				// Reset body to collapsed instantly
				body.style.height = '0px';
				body.style.paddingTop = '0.5px';
				body.style.paddingBottom = '0px';
				body.style.transition = '';

				// Force reflow
				body.offsetHeight;

				// Compute final height after DOM is laid out
				const finalHeight = body.scrollHeight;

				// Apply transition
				body.style.transition = `height ${totalDuration}ms cubic-bezier(.2,.9,.2,1), padding ${totalDuration}ms cubic-bezier(.2,.9,.2,1)`;

				// Animate to final height and restore padding
				requestAnimationFrame(() => {
					body.style.height = `${finalHeight}px`;
					body.style.paddingTop = '';
					body.style.paddingBottom = '';
				});

				// Cleanup after transition
				const onTransitionEnd = (ev) => {
					if (ev.target !== body || (ev.propertyName !== 'height' && ev.propertyName !== 'padding-top' && ev.propertyName !== 'padding-bottom')) return;
					body.removeEventListener('transitionend', onTransitionEnd);
					body.style.transition = '';
					body.style.height = '';
					body.style.paddingTop = '';
					body.style.paddingBottom = '';
					// clear controller
					if (this.sectionState && this.sectionState[name]) this.sectionState[name]._controller = null;
				};

				const controller = { bodyEl: body, timers: [], transitionHandler: onTransitionEnd };
				this.sectionState[name]._controller = controller;
				body.addEventListener('transitionend', onTransitionEnd);
				});

				this.sectionState[name].collapsed = false;

			} else {
				// -------- CLOSE --------
				this.$nextTick(() => {
				let body = this.$refs[`${name}Body`];
				body = normalizeRef(body);
				const items = this.$refs[`${name}Items`] || [];
				const itemCount = Array.isArray(items) ? items.length : (items ? 1 : 0);

				if (!body) return;

				const currentHeight = body.scrollHeight;
				// safe getComputedStyle usage now because body is guaranteed to be an Element
				const cs = getComputedStyle(body);
				const currentPaddingTop = parseFloat(cs.paddingTop) || 0;
				const currentPaddingBottom = parseFloat(cs.paddingBottom) || 0;

				// Compute total duration based on per-item stagger
				const hideStagger = 30;
				const itemAnimDuration = 260;
				const buffer = 20;
				const lastDelay = Math.max(0, (itemCount - 1) * hideStagger);
				const totalDuration = lastDelay + itemAnimDuration + buffer;

				// Start transition from current height
				body.style.height = `${currentHeight}px`;
				body.style.paddingTop = `${currentPaddingTop}px`;
				body.style.paddingBottom = `${currentPaddingBottom}px`;
				body.style.transition = `height ${totalDuration}ms cubic-bezier(.2,.9,.2,1), padding ${totalDuration}ms cubic-bezier(.2,.9,.2,1)`;

				// Force reflow
				body.offsetHeight;

				// Animate to collapsed
				requestAnimationFrame(() => {
					body.style.height = '0px';
					body.style.paddingTop = '0px';
					body.style.paddingBottom = '0px';
				});

				// Cleanup after transition
				const onTransitionEnd = (ev) => {
					if (ev.target !== body || (ev.propertyName !== 'height' && ev.propertyName !== 'padding-top' && ev.propertyName !== 'padding-bottom')) return;
					body.removeEventListener('transitionend', onTransitionEnd);
					body.style.transition = '';
					body.style.height = '0px';
					body.style.paddingTop = '';
					body.style.paddingBottom = '';
					// mark not visible now that animation finished
					if (this.sectionState && this.sectionState[name]) this.sectionState[name].visible = false;
					if (this.sectionState && this.sectionState[name]) this.sectionState[name]._controller = null;
				};

				const controller = { bodyEl: body, timers: [], transitionHandler: onTransitionEnd };
				this.sectionState[name]._controller = controller;
				body.addEventListener('transitionend', onTransitionEnd);
				});

				this.sectionState[name].collapsed = true;
			}
			},




			optionStyle(sectionName, idx, total) {
				const isCollapsed = !!(this.sectionState && this.sectionState[sectionName] && this.sectionState[sectionName].collapsed);
				const showStagger = 45;
				const hideStagger = 30;
				let delayMs = 0;
				if (!isCollapsed) {
					delayMs = idx * showStagger;
				} else {
					delayMs = (total - idx - 1) * hideStagger;
				}
				return {
					transitionDelay: `${delayMs}ms`
				};
			},

			_clearControllers() {
				if (!this.sectionState) return;
				Object.keys(this.sectionState).forEach(name => {
					const state = this.sectionState[name];
					if (!state || !state._controller) return;
					const ctrl = state._controller;
					try {
					if (ctrl.transitionHandler && ctrl.bodyEl) {
						ctrl.bodyEl.removeEventListener('transitionend', ctrl.transitionHandler);
					}
					} catch (e) { /* ignore */ }
					(ctrl.timers || []).forEach(t => clearTimeout(t));
					state._controller = null;
				});
			},




			


			visibleProperties(obj) {



				
				// print(this.options[this.selectedSide]);

				
			
				const allowedKeys = new Set([
					'battleSide',
					'type',
					'number',
					'damaged',
					'galvanized',
					// 'notInitBombardment',
					'notParticipating',
					'notActiveSystem',
					'spaceArea',
					'planet',
					'activeSystemAdjacentPlanet',
					'present',
					]);
				
				if (this.selectedSide === window.BattleSide.attacker && this.options[this.selectedSide].abilities.harrow && this.battleType === window.BattleType.Ground){
					allowedKeys.add('notInitBombardment');
				}
				if (this.options[this.selectedSide].ralnelCommander && this.battleType === window.BattleType.Space){
					allowedKeys.add('retreatEarly');
				}


				const result = {};
					Object.keys(obj || {}).forEach(key => {
						if (allowedKeys.has(key)) {
						result[key] = obj[key];
						}
					});

				return result;
			},


			toggleBreakdown() {
				this.showBreakdown = !this.showBreakdown;
				this.closeUnitModal();
				if (this.showBreakdown) {
					// keep same references so edits in the modal affect the live unitsFull array
					this.breakdown.attacker = this.unitsFull.attacker;
					this.breakdown.defender = this.unitsFull.defender;
				}
			},

			openUnit(unit, side, index) {
				// clicking the already-open unit closes the modal
				if (this.showUnitModal && this.selectedUnit === unit && this.selectedSide === side && this.selectedIndex === index) {
					return this.closeUnitModal();
				}
				this.selectedUnit = unit;
				this.selectedSide = side;
				this.selectedIndex = index;
				this.showUnitModal = true;
			},

			closeUnitModal() {
				this.showUnitModal = false;
				this.selectedUnit = null;
				this.selectedSide = null;
				this.selectedIndex = null;
			},


			prettyLabel(key) {
				const str = String(key).replace(/([A-Z])/g, ' $1').replace(/[_\-]/g, ' ');
				return str.charAt(0).toUpperCase() + str.slice(1);
			},

			isBooleanProp(key) {
				return !!this.selectedUnit && typeof this.selectedUnit[key] === 'boolean';
			},

			isNumberProp(key) {
				return !!this.selectedUnit && typeof this.selectedUnit[key] === 'number';
			},

			propMin(key) {
				if (key === 'number') return 0;
				return Number.NEGATIVE_INFINITY;
			},

			propMax(key) {
				if (key === 'number') return 10;
				return Number.POSITIVE_INFINITY;
			},

			propStep(/* key */) {
				return 1;
			},

			incrementProp(key) {
				if (!this.selectedUnit) return;
				if (this.selectedUnit[key] == null) this.$set(this.selectedUnit, key, 0);
				const step = this.propStep(key) || 1;
				const max = this.propMax(key);
				if (this.selectedUnit[key] + step <= max) this.selectedUnit[key] += step;
				this.$forceUpdate();
			},

			decrementProp(key) {
				if (!this.selectedUnit) return;
				if (this.selectedUnit[key] == null) this.$set(this.selectedUnit, key, 0);
				const step = this.propStep(key) || 1;
				const min = this.propMin(key);
				if (this.selectedUnit[key] - step >= min) this.selectedUnit[key] -= step;
				this.$forceUpdate();
			},

			incrementSelectedNumber() { this.incrementProp('number'); },
			decrementSelectedNumber() { this.decrementProp('number'); },

			
			toggleProp(key){
				const updates = {};
				updates[key] = !this.selectedUnit[key];
				
				this.selectedUnit.update(updates)
				this.$forceUpdate();
			},

			unitDynamicClasses(unit) {
				if (!unit || typeof unit !== 'object') return {};
				const exclude = new Set(['shortType', 'type', 'battleSide', 'number']);
				const out = {};
				for (const [k, v] of Object.entries(unit)) {
					if (exclude.has(k)) continue;
					if (typeof v === 'boolean' && v) out[k] = true;
				}
				return out;
			},


			getTGDisplay(battleSide){
				
				var output = '';
				if (this.accumulation[battleSide].tgsEarned !== 0 && this.accumulation[battleSide].tgsSpent === 0){
					output += `TGs: ${this.accumulation[battleSide].tgsEarned.toFixed(3)}↑`;
				} else if (this.accumulation[battleSide].tgsEarned === 0 && this.accumulation[battleSide].tgsSpent !== 0){
					output += `TGs: ${this.accumulation[battleSide].tgsSpent.toFixed(3)}↓`;
				} else if (this.accumulation[battleSide].tgsEarned !== 0 && this.accumulation[battleSide].tgsSpent !== 0){
					output += `TGs: ${this.accumulation[battleSide].tgsEarned.toFixed(3)}↑/${this.accumulation[battleSide].tgsSpent.toFixed(3)}↓`;
				}
				return output;

			},
			









			increment: function (unitInput) {
				unitInput.count++;

			},

			decrement: function (unitInput) {
				unitInput.count = unitInput.count === 0 ? 0 : unitInput.count - 1;
			},
			displayName: function (unitType) {
				if (unitType === UnitType.WarSun) return 'War Sun';
				else if (unitType === UnitType.SpaceDock) return 'Space Dock';
				else return unitType;
			},
			
			clear: function (side) {
				

				var result = getDefaultInput(true);

				
				
				
				
				
				const srcOptions = result.options[side];
				const dstOptions = this.options[side];
				const dstUnits = this.units[side]; // units.attacker or units.defender
				const srcUnits = result.units[side];

				
				

				
				const keys = Object.keys(this.currentOptions[side]);

				// Update options
				for (const key in srcOptions) {
					
					if (key === 'faction' || key === 'units' || !keys.includes(key)) continue; // keep faction, skip units here
					if (dstOptions.hasOwnProperty(key)) {
						dstOptions[key] = srcOptions[key];
					} else {
						dstOptions[key] = srcOptions[key]; // optional: add missing keys
					}
				}

				

				// Update units
				for (const unitType in srcUnits) {
					if (!dstUnits[unitType]) continue;
					const srcUnit = srcUnits[unitType];
					const dstUnit = dstUnits[unitType];

					for (const prop in srcUnit) {
						dstUnit[prop] = srcUnit[prop]; // overwrite properties like count, upgraded, etc.
					}
				}
				

				this.breakdown[side] = [];
				this.unitsFull[side] = [];
				
				// print(this.units);
				// resetUpdatesAndTechnologies(side)(this.options[side].faction, this.options[side].faction);
				
				setFactionDefaults(side, this.options[side].faction, this);

				
				
			},
			recompute: function () {

				
				
				
				this.computing = true;
				var self = this;


				
				
				

				
				
				setTimeout(function () {

					self.tallyCosts();
					
					persistInput();
					print(self.unitsCanon);
					print(self.unitsVersion);
					lastComputed = calculator.computeProbabilities(self);

					// self.currentOptionsOld = structuredClone(self.currentOptions);
					
					// this.accumulation.rounds = lastComputed.accumulations.rounds;
					self.setAccumulation(lastComputed[0]);
					self.displayDistribution(lastComputed);

					
					self.computing = false;
					
				}, 15); // number is magic. but at least the spinner has time to show up before calculation begins
				
				
				

				
			},
			setAccumulation: function (solution) {
				this.accumulation = solution.accumulations;
			},
			displayDistribution: function (solutions) {

				drawChart(solutions[0], solutions[1]);

				// drawChart(solution);
				
				// drawTotalWinProbabilities(solution.distribution);

				drawTotalWinProbabilities(solutions[0].distribution);

				return;

				// function drawChart(solution) {
				// 	var labels = [];
				// 	var data = [];
				// 	var dataLabels = [];
				// 	var from = Math.min(-8, solution.distribution.min);
				// 	var to = Math.max(8, solution.distribution.max);
				// 	for (var i = from; i <= to; ++i) {
				// 		labels.push(getLabel(i, solution.attacker, solution.defender));
				// 		if (i === 0) {
				// 			data.push(solution.distribution.at(0) * 100);
				// 			dataLabels.push(Math.round(solution.distribution.at(0) * 1000).toString()/10 + '%');
				// 		} else {
				// 			data.push(solution.distribution.downTo(i) * 100);
				// 			dataLabels.push(Math.round(solution.distribution.downTo(i) * 1000).toString()/10 + '%');
				// 		}
				// 	}
				// 	RGraph.clear(document.getElementById('chart-area'));
				// 	RGraph.ObjectRegistry.Clear();

				// 	var line = new RGraph.Line('chart-area', data)
				// 		.Set('labels', labels)
				// 		.Set('chart.background.grid.vlines', true)
				// 		.Set('chart.background.grid.autofit.numvlines', 1)
				// 		.Set('chart.filled', true)
				// 		.Set('chart.tickmarks', 'circle')
				// 		.Set('chart.numxticks', 0)
				// 		.Set('chart.ymax', Math.max.apply(null, data) * 1.08)
				// 		.Set('chart.colors', ['rgba(200,200,256,0.7)']);
				// 	if (to - from < 20)
				// 		line.Set('chart.labels.ingraph', dataLabels);
				// 	else
				// 		line.Set('chart.tooltips', dataLabels);
				// 	line.Draw();

				// 	function getLabel(i, attacker, defender) {
				// 		if (i === 0)
				// 			return '=';
				// 		if (i < 0) {
				// 			i = -i;
				// 			if (i <= attacker.length)
				// 				return attacker[i - 1];
				// 			else
				// 				return '';
				// 		}
				// 		else {
				// 			if (i <= defender.length)
				// 				return defender[i - 1];
				// 			else
				// 				return '';
				// 		}
				// 	}
				// }

				
				function drawChart(solution, solution2) {

					
					var labels = [];
					var data = [];
					var dataLabels = [];
					var solution2min = solution2.distribution.min || 0;
					var solution2max = solution2.distribution.max || 0;
					var from = Math.min(-8, Math.min(solution.distribution.min,solution2min));
					var to = Math.max(8, Math.max(solution.distribution.max,solution2max));

					for (var i = from; i <= to; ++i) {
						labels.push(getLabel(i, solution.attacker, solution.defender));
						if (i === 0) {
							var v = solution.distribution.at(0) * 100;
							data.push(v);
							dataLabels.push((Math.round(solution.distribution.at(0) * 1000) / 10) + '%');
						} else {
							var v2 = solution.distribution.downTo(i) * 100;
							data.push(v2);
							dataLabels.push((Math.round(solution.distribution.downTo(i) * 1000) / 10) + '%');
						}
					}

					// If solution2 not provided, synthesize as half of solution (for testing)
					// if (!solution2) {
					// 	solution2 = {
					// 		distribution: {
					// 			at: x => solution.distribution.at(x) * 0.5,
					// 			downTo: x => solution.distribution.downTo(x) * 0.5
					// 		},
					// 		attacker: solution.attacker,
					// 		defender: solution.defender
					// 	};
					// }

					// Build data for solution2 using the SAME x-range & labels (so overlay aligns)
					var data2 = [];
					var dataLabels2 = [];
					var EPS = 1e-12;
					for (var i = from; i <= to; ++i) {
						var val = (i === 0 ? solution2.distribution.at(0) : solution2.distribution.downTo(i)) * 100;
						data2.push(val);
						dataLabels2.push(Math.abs(val) <= EPS ? '' :
							((Math.round((i === 0 ? solution2.distribution.at(0) : solution2.distribution.downTo(i)) * 1000) / 10) + '%'));
					}

					// --- 1️⃣ Remove “zero islands” for solution2 (both neighbors zero + self zero) ---
					var cleanedData2 = data2.slice();
					for (let i = 0; i < cleanedData2.length; ++i) {
						const prev = i > 0 ? cleanedData2[i - 1] : 0;
						const next = i < cleanedData2.length - 1 ? cleanedData2[i + 1] : 0;
						if (Math.abs(cleanedData2[i]) <= EPS && Math.abs(prev) <= EPS && Math.abs(next) <= EPS) {
							cleanedData2[i] = null; // RGraph skips nulls → no node or connecting line
						}
					}

					// --- 2️⃣ Determine if solution2 is all zeros ---
					const solution2AllZeros = data2.every(v => Math.abs(v) <= EPS);

					// compute shared chart ymax from both series (use original 1.08 padding)
					var combinedMax = Math.max.apply(null, data.concat(data2));
					var chartYMax = combinedMax * 1.08;

					// compute area under each curve
					var area1 = data.reduce((s, v) => s + Math.max(0, v), 0);
					var area2 = data2.reduce((s, v) => s + Math.max(0, v), 0);

					// --- Transparency adjustment based on whether solution2 is all zeros ---
					// (Lower alpha → more transparent)
					var alpha1 = 0.7;
					var alpha2 = 0.7;
					if (!solution2AllZeros) {
						alpha1 = 0.45;
						alpha2 = 0.35;
					}

					RGraph.clear(document.getElementById('chart-area'));
					RGraph.ObjectRegistry.Clear();

					// Draw order: smaller area on top
					const firstIsSolution1 = area1 >= area2;

					

					
					if (firstIsSolution1){	

						

						const line = new RGraph.Line('chart-area', data)
							.Set('labels', labels)
							.Set('chart.background.grid.vlines', true)
							.Set('chart.background.grid.autofit.numvlines', 1)
							.Set('chart.filled', true)
							.Set('chart.tickmarks', 'circle')
							.Set('chart.numxticks', 0)
							.Set('chart.ymax', chartYMax)
							.Set('chart.colors', [`rgba(200,200,256,${alpha1})`]);
						if (to - from < 20) line.Set('chart.labels.ingraph', dataLabels);
						else line.Set('chart.tooltips', dataLabels);

						// if (to - from < 20) line.Set('chart.labels.ingraph', dataLabels2);
						// else line.Set('chart.tooltips', dataLabels2);
						line.Draw();

						const line2 = new RGraph.Line('chart-area', cleanedData2)
							
							
							
							.Set('chart.filled', true) // fill under the line
							.Set('chart.tickmarks', 'circle') // circles at the points
							
							.Set('chart.ymax', chartYMax)
							.Set('chart.colors', [`rgba(200,120,120,${alpha2})`])
							.Set('chart.noaxes', true)
							.Set('chart.background.grid', false)
							.Set('chart.ylabels', false)
							
							
							
							// .Set('chart.background.barcolor1', 'transparent')
						if (to - from < 20) line2.Set('chart.labels.ingraph', dataLabels2);
						else line2.Set('chart.tooltips', dataLabels2);

						line2.Draw();
					
					} else {

						const line = new RGraph.Line('chart-area', cleanedData2)
							.Set('labels', labels)
							.Set('chart.background.grid.vlines', true)
							.Set('chart.background.grid.autofit.numvlines', 1)
							.Set('chart.filled', true)
							.Set('chart.tickmarks', 'circle')
							.Set('chart.numxticks', 0)
							.Set('chart.ymax', chartYMax)
							.Set('chart.colors', [`rgba(200,120,120,${alpha2})`]);
						if (to - from < 20) line.Set('chart.labels.ingraph', dataLabels2);
						else line.Set('chart.tooltips', dataLabels2);

						// if (to - from < 20) line.Set('chart.labels.ingraph', dataLabels2);
						// else line.Set('chart.tooltips', dataLabels2);
						line.Draw();

						const line2 = new RGraph.Line('chart-area', data)
							
							
							
							.Set('chart.filled', true) // fill under the line
							.Set('chart.tickmarks', 'circle') // circles at the points
							
							.Set('chart.ymax', chartYMax)
							.Set('chart.colors', [`rgba(200,200,256,${alpha1})`])
							.Set('chart.noaxes', true)
							.Set('chart.background.grid', false)
							.Set('chart.ylabels', false)
							
							
							
							// .Set('chart.background.barcolor1', 'transparent')
						if (to - from < 20) line2.Set('chart.labels.ingraph', dataLabels);
						else line2.Set('chart.tooltips', dataLabels);

						line2.Draw();

					}

					


					function getLabel(i, attacker, defender) {
						if (i === 0) return '=';
						if (i < 0) {
							i = -i;
							return attacker[i - 1] || '';
						} else {
							return defender[i - 1] || '';
						}
					}
				}



				

				function drawTotalWinProbabilities(distribution) {
					var attackerWinProbability = 0;
					var defenderWinProbability = 0;
					var drawProbability = distribution.at(0);
					for (var i = distribution.min; i < 0; i++) {
						attackerWinProbability += distribution.at(i);
					}
					for (var i = 1; i <= distribution.max; i++) {
						defenderWinProbability += distribution.at(i);
					}
					var roundedAttackerProbability = Math.round(attackerWinProbability * 1000)/10;
					var roundedDefenderProbability = Math.round(defenderWinProbability * 1000)/10;
					var roundedDrawProbability = Math.round(((100-roundedAttackerProbability)-roundedDefenderProbability) * 10)/10;

					var canvas = document.getElementById('chart-area-overlay');
					RGraph.clear(canvas);
					var context = canvas.getContext('2d');
					var canvasWidth = canvas.width;
					var canvasHeight = canvas.height;
					context.font = 'bold 95px Arial';

					context.fillStyle = 'rgba(256, 100, 100, 0.5)';
					
					context.fillText(roundedAttackerProbability + '%', 0.7*canvasWidth / 12, 3 * canvasHeight / 4);

					context.fillStyle = 'rgba(100, 100, 256, 0.5)';
					
					context.fillText(roundedDefenderProbability + '%', 6.5 * canvasWidth / 12, 3 * canvasHeight / 4);

					if (drawProbability > .005 && (roundedAttackerProbability + roundedDefenderProbability) < 100 ) {
						context.font = 'bold 80px Arial';
						context.fillStyle = 'rgba(160, 160, 160, 0.5)';
						context.fillText(roundedDrawProbability + '%', 5 * canvasWidth / 12, 3 * canvasHeight / 8);
					}
				}
			},
			tallyCosts: function () {
				tally(this.costs.attacker, this.unitsFull.attacker, this.options.attacker);
				tally(this.costs.defender, this.unitsFull.defender, this.options.defender);

				function tally(costs, units, sideOptions) {
					costs.count = 0;
					costs.cost = 0;
					// for (var unitType in UnitType) {
					// 	if (unitType === UnitType.PDS) continue;
					// 	var counter = units[unitType];
					// 	costs.count += counter.count;
					// 	costs.cost += (counter.upgraded && MergedUpgrades[unitType].cost || MergedUnits[unitType].cost) * counter.count;
					// }

					for (const unit of units){
						costs.count += 1;
						costs.cost += unit.cost || 0;
					}
				}	
			},
			
			participates: function (battleSide, unitType) {
				
				// var unit = this.unitStats[battleSide][unitType];

			

				
				// if (this.battleType === 'Space') {
				// 	return unit.typeShip || (unit.spaceCannonDice > 0)
				// } else {
				// 	return unit.typeGroundForce || (unit.bombardmentDice > 0 && battleSide === 'attacker') || (unit.planetaryShield && battleSide === 'defender') || (unit.spaceCannonDice > 0 && battleSide === 'defender')
				// }
				return true;
			},
			
			listCount: function (count) {
				var result = [];
				for (var i = 0; i <= count; i++)
					result.push(i);
				return result;
			},

			damagedVisible: function (battleSide, unitType) {
				var units = battleSide === 'defender'  ? this.units.defender : this.units.attacker;
				return damageable(this.options[battleSide].faction, unitType, units[unitType].upgraded, this.options[battleSide])
			},



			

			unitTypeSideVisible: function (battleSide,unitType) {
				return false;
				// return unitType === 'Planet';
				// return unitType === 'Planet' && battleSide === 'attacker';
			},

			


		},
		watch: {
			'options.attacker.faction': resetUpdatesAndTechnologies('attacker', this),
			'options.defender.faction': resetUpdatesAndTechnologies('defender', this),
			
			
			unitsFull: allHandler(this),
			
			

			// battleType : allHandler(this),
			battleType : updateUnitsFullAll(this),
			options: allHandler(this),
			// options: recomputeHandler,
			canvasSize: function () {
				persistInput();
				var self = this;
				if (lastComputed)
					this.$nextTick(function () {
						this.displayDistribution(lastComputed);
					});
			},
			forceSlow: recomputeHandler,

			twilightsFall() {
				
				if (typeof this.applySectionRules === 'function') {
					this.applySectionRules();
				}
				if (this.twilightsFall){
					this.options.attacker.faction = 'Pink';
					this.options.defender.faction = 'Pink';
					resetUpdatesAndTechnologies('attacker', this)('Pink');
					resetUpdatesAndTechnologies('defender', this)('Pink');
				}

				if (!this.twilightsFall){
					this.options.attacker.faction = 'Arborec';
					this.options.defender.faction = 'Arborec';
					resetUpdatesAndTechnologies('attacker', this)('Arborec');
					resetUpdatesAndTechnologies('defender', this)('Arborec');
				}
			},


			'options.attacker.publicize': function (value) {
				this.options.defender.publicize = value;
			},
			'options.defender.publicize': function (value) {
				this.options.attacker.publicize = value;
			},
			'options.attacker.articlesOfWar': function (value) {
				this.options.defender.articlesOfWar = value;
			},
			'options.defender.articlesOfWar': function (value) {
				this.options.attacker.articlesOfWar = value;
			},
			'options.attacker.entropicScar': function (value) {
				this.options.defender.entropicScar = value;
			},
			'options.defender.entropicScar': function (value) {
				this.options.attacker.entropicScar = value;
			},
			'options.attacker.activeBreach': function (value) {
				this.options.defender.activeBreach = value;
			},
			'options.defender.activeBreach': function (value) {
				this.options.attacker.activeBreach = value;
			},

			// 'options.attacker.crimsonFlagshipWeaken': function (value) {
			// 	this.options.defender.crimsonFlagshipWeaken = value;
			// },
			// 'options.defender.crimsonFlagshipWeaken': function (value) {
			// 	this.options.attacker.crimsonFlagshipWeaken = value;
			// },

			'options.attacker.emergencyRepairsHalf': function (value) {
				if (this.options.attacker.emergencyRepairsHalf){
					this.options.attacker.emergencyRepairsAll = false;
				}
				
			},
			'options.defender.emergencyRepairsHalf': function (value) {
				if (this.options.defender.emergencyRepairsHalf){
					this.options.defender.emergencyRepairsAll = false;
				}
				
			},

			'options.attacker.emergencyRepairsAll': function (value) {
				if (this.options.attacker.emergencyRepairsAll){
					this.options.attacker.emergencyRepairsHalf = false;
				}
				
			},
			'options.defender.emergencyRepairsAll': function (value) {
				if (this.options.defender.emergencyRepairsAll){
					this.options.defender.emergencyRepairsHalf = false;
				}
				
			},


			// 'options.attacker.orangeMechRepairsHalf': function (value) {
			// 	if (this.options.attacker.emergencyRepairsHalf){
			// 		this.options.attacker.emergencyRepairsAll = false;
			// 	}
				
			// },
			// 'options.defender.emergencyRepairsHalf': function (value) {
			// 	if (this.options.defender.emergencyRepairsHalf){
			// 		this.options.defender.emergencyRepairsAll = false;
			// 	}
				
			// },

			// 'options.attacker.emergencyRepairsAll': function (value) {
			// 	if (this.options.attacker.emergencyRepairsAll){
			// 		this.options.attacker.emergencyRepairsHalf = false;
			// 	}
				
			// },
			// 'options.defender.emergencyRepairsAll': function (value) {
			// 	if (this.options.defender.emergencyRepairsAll){
			// 		this.options.defender.emergencyRepairsHalf = false;
			// 	}
				
			// },

		},

		
		
		
		
		
		

		mounted() {

			// this.$watch('options.defender.activeBreach', (newVal) => {
			// 		if (newVal) {
			// 			// Loop all unitTypes
			// 			print('on')
			// 		} else {
			// 			print('off')
			// 		}
			// 	});

			

			for (const optionGroup of Everything){
				
				for (const optionName of Object.keys(optionGroup)){
					const option = optionGroup[optionName];
					const string = option.under === undefined ? '' : '.' + option.under;
					for (const off of option.exclusive){
						this.$watch( 'options.attacker'+string+'.' + optionName, (value) => {
							if (value){
								this.options.attacker[off] = false;
							}
						});

						this.$watch( 'options.defender'+string+'.' + optionName, (value) => {
							if (value){
								this.options.defender[off] = false;
							}
						});
					}
				}
			}

			for (const unitType in UnitType){
				this.$watch( 'units.attacker.'+unitType+'.count', updateUnitsFull('attacker',unitType, false));
				this.$watch( 'units.attacker.'+unitType+'.damaged', updateUnitsFull('attacker',unitType, true));
				// this.$watch( 'units.attacker.'+unitType+'.upgraded', updateUnitsFull('attacker',unitType, true));
				this.$watch( 'units.defender.'+unitType+'.count', updateUnitsFull('defender',unitType, false));
				this.$watch( 'units.defender.'+unitType+'.damaged', updateUnitsFull('defender',unitType, true));
				// this.$watch( 'units.defender.'+unitType+'.upgraded', updateUnitsFull('defender',unitType, true));

				this.$watch( 'unitsCanon.attacker.'+unitType, updateUnitsFull('attacker',unitType, true));
				this.$watch( 'units.attacker.'+unitType+'.upgraded', switchUpgrade('attacker', unitType));

				this.$watch( 'unitsCanon.defender.'+unitType, updateUnitsFull('defender',unitType, true));
				this.$watch( 'units.defender.'+unitType+'.upgraded', switchUpgrade('defender', unitType));


				// this.$watch('options.attacker.upgrade' + unitType, (newVal) => {
				// 	if (newVal) {
				// 		// Loop all unitTypes
				// 		for (const otherUnitType in UnitType) {
				// 			// Skip the one that was just turned on
				// 			if (otherUnitType !== unitType) {
				// 				this.options.attacker['upgrade' + otherUnitType] = false;
				// 			}
				// 		}
				// 	}
				// });

				// this.$watch('options.defender.upgrade' + unitType, (newVal) => {
				// 	if (newVal) {
				// 		// Loop all unitTypes
				// 		for (const otherUnitType in UnitType) {
				// 			// Skip the one that was just turned on
				// 			if (otherUnitType !== unitType) {
				// 				this.options.defender['upgrade' + otherUnitType] = false;
				// 			}
				// 		}
				// 	}
				// });
			}
			

			for (const unitName in UniqueUnits){
				const unit = UniqueUnits[unitName];
				

				// this.$watch( 'options.attacker.units.'+unitName, updateUnitsFull('attacker',unit.type, true));
				// this.$watch( 'options.defender.units.'+unitName, updateUnitsFull('defender',unit.type, true));

				// if (unit.type === UnitType.Cruiser || unit.type === UnitType.Destroyer || unit.type === UnitType.Dreadnought){
				// 	this.$watch( 'options.attacker.units.'+unitName, updateUnitsFull('attacker',UnitType.Flagship, true, function(vm){return vm.options.attacker.units.pinkFlagship}));
				// 	this.$watch( 'options.defender.units.'+unitName, updateUnitsFull('defender',UnitType.Flagship, true, function(vm){return vm.options.defender.units.pinkFlagship}));
				// }

				this.$watch( 'options.attacker.units.'+unitName, updateUnitsVersion('attacker',unit.type, unitName, UniqueUnitUpgradesOptions.hasOwnProperty(unitName)));
				this.$watch( 'options.defender.units.'+unitName, updateUnitsVersion('defender',unit.type, unitName, UniqueUnitUpgradesOptions.hasOwnProperty(unitName)));

				
			}
			for (const unitName in FlagshipAbility){
				this.$watch( 'options.attacker.units.'+unitName, updateUnitsFull('attacker',UnitType.Flagship, true));
				this.$watch( 'options.defender.units.'+unitName, updateUnitsFull('defender',UnitType.Flagship, true));
			}
			this.$watch( 'options.attacker.lightrail', updateUnitsFull('attacker',UnitType.SpaceDock, true));
			this.$watch( 'options.defender.lightrail', updateUnitsFull('defender',UnitType.SpaceDock, true));

			for (const unitName in UniqueUnitBuffs){
				const unitType= UniqueUnitBuffs[unitName].description.split(" ")[0];
				this.$watch( 'options.attacker.units.' + unitName, updateUnitsFull('attacker',UnitType[unitType], true));
				this.$watch( 'options.defender.units.' + unitName, updateUnitsFull('defender',UnitType[unitType], true));
			}
			


			// this.$watch( 'battleType', updateUnitsFullAll(this));
			
			

			// this.$watch('twilightsFall', updateUnitsFullAll(this));

			

			
		},


		
		
		computed: {

			attackerFactionList() {
				return this.twilightsFall
					? FactionsDisplayNames_TF   // <-- You supply this list
					: FactionsDisplayNames;      // <-- Already exists
			},

			defenderFactionList() {
				return this.twilightsFall
					? FactionsDisplayNames_TF
					: FactionsDisplayNames;
			},


			currentOptions() {
				const vm = this;
				// const result = {};
				result = {
					attacker:{},
					defender: {},
				};
				

				// Keep SECTION_NAMES in the same scope as earlier. If absent, fall back to this list:
				const sections = SECTION_NAMES;

				sections.forEach(sec => {
					const state = vm.sectionState && vm.sectionState[sec];

					
					// only include section if it 'exists' (per your requirement)
					if (!state || !state.exist) return;

					const getter = vm[sec];
					
					for (const pair of getter){
						
						if (pair.key){
							if (pair.cans[0]){
								

								result.attacker[pair.key] = {
									option:{
										default: pair.option.default,
										under: pair.option.under,
										inputType: pair.option.inputType
									},
									
								}
							}
							if (pair.cans[1]){
								result.defender[pair.key] = {
									option:{
										default: pair.option.default,
										under: pair.option.under,
										inputType: pair.option.inputType
									},
								}
							}
							
							
							

						}
						else if (pair.pair){
							
							const a = pair.pair.attacker;
							const d = pair.pair.defender;
							
							
							result.attacker[a.key]= {
								
								option:{
									default: a.option.default,
									under: a.option.under,
									inputType: a.option.inputType
								},
								
							};
							result.defender[d.key]={
								
								option:{
									default: d.option.default,
									under: d.option.under,
									inputType: d.option.inputType
								},
								
							};
						}
					}
					
					
					
				});
				
				return result;
			}, 
			 
			


			
			// buildList() {
			// 	const vm = this;

			// 	return (source = {}) => {
			// 		if (!source || typeof source !== 'object') return [];

			// 		// Normalize source into an array of objects
			// 		const sources = Array.isArray(source) ? source : [source];

			// 		const out = [];
			// 		const unmatched = {
			// 		attackerOnly: null,
			// 		defenderOnly: null,
			// 		attackerFaction: {},
			// 		defenderFaction: {}
			// 		};

			// 		sources.forEach(container => {
			// 		const keys = Object.keys(container.group || container);

			// 		keys.forEach(key => {
			// 			const item = (container.group || container)[key];
			// 			if (!item) return;

			// 			// Check availability (now fully wrapped per option)
			// 			const aCan = typeof item.availableFor === 'function'
			// 			? item.availableFor('attacker', vm.units?.attacker || {}, vm.unitsFull?.attacker || [], vm.battleType, vm.twilightsFall, vm.unitsVersion, vm, 1)
			// 			: true;
			// 			const dCan = typeof item.availableFor === 'function'
			// 			? item.availableFor('defender', vm.units?.defender || {}, vm.unitsFull?.defender || [], vm.battleType, vm.twilightsFall, vm.unitsVersion, vm, 2)
			// 			: true;

			// 			if (!aCan && !dCan) return;

						

			// 			// Determine category
			// 			let isBoth = false;
			// 			let isAttackerOnly = false;
			// 			let isDefenderOnly = false;
			// 			let isAttackerFaction = false;
			// 			let isDefenderFaction = false;

			// 			if (item.limitedToSide === 'attacker' && aCan) isAttackerOnly = true;
			// 			else if (item.limitedToSide === 'defender' && dCan) isDefenderOnly = true;
			// 			else if (item.limitedToFaction) {
			// 			const fv = item.limitedToFaction;
			// 			const attackerMatches = Array.isArray(fv)
			// 				? fv.includes(vm.options.attacker.faction)
			// 				: fv === vm.options.attacker.faction;
			// 			const defenderMatches = Array.isArray(fv)
			// 				? fv.includes(vm.options.defender.faction)
			// 				: fv === vm.options.defender.faction;

			// 			if (attackerMatches && aCan) isAttackerFaction = true;
			// 			if (defenderMatches && dCan) isDefenderFaction = true;
			// 			} else if (aCan && dCan) {
			// 				isBoth = true;
			// 			} else if (aCan) {
			// 				isAttackerOnly = true;
			// 			} else if (dCan) {
			// 				isDefenderOnly = true;
			// 			}

			// 			// Pairing logic
			// 			if (isAttackerOnly && unmatched.defenderOnly) {
			// 			const prev = unmatched.defenderOnly;
			// 			out[prev.outIndex] = {
			// 				pair: {
			// 				[BattleSide.attacker]: { key, option: item },
			// 				[BattleSide.defender]: { key: prev.key, option: prev.item }
			// 				}
			// 			};
			// 			unmatched.defenderOnly = null;
			// 			return;
			// 			}

			// 			if (isDefenderOnly && unmatched.attackerOnly) {
			// 			const prev = unmatched.attackerOnly;
			// 			out[prev.outIndex] = {
			// 				pair: {
			// 				[BattleSide.attacker]: { key: prev.key, option: prev.item },
			// 				[BattleSide.defender]: { key, option: item }
			// 				}
			// 			};
			// 			unmatched.attackerOnly = null;
			// 			return;
			// 			}

			// 			if (isAttackerFaction && unmatched.defenderFaction[vm.options.defender.faction]) {
			// 			const prev = unmatched.defenderFaction[vm.options.defender.faction];
			// 			out[prev.outIndex] = {
			// 				pair: {
			// 				[BattleSide.attacker]: { key, option: item },
			// 				[BattleSide.defender]: { key: prev.key, option: prev.item }
			// 				}
			// 			};
			// 			delete unmatched.defenderFaction[vm.options.defender.faction];
			// 			return;
			// 			}

			// 			if (isDefenderFaction && unmatched.attackerFaction[vm.options.attacker.faction]) {
			// 			const prev = unmatched.attackerFaction[vm.options.attacker.faction];
			// 			out[prev.outIndex] = {
			// 				pair: {
			// 				[BattleSide.attacker]: { key: prev.key, option: prev.item },
			// 				[BattleSide.defender]: { key, option: item }
			// 				}
			// 			};
			// 			delete unmatched.attackerFaction[vm.options.attacker.faction];
			// 			return;
			// 			}

			// 			// Push single and track unmatched
			// 			const outIndex = out.length;
			// 			out.push({ key, option: item , cans: [aCan, dCan]});

			// 			if (isAttackerOnly && !unmatched.attackerOnly) unmatched.attackerOnly = { outIndex, key, item };
			// 			if (isDefenderOnly && !unmatched.defenderOnly) unmatched.defenderOnly = { outIndex, key, item };
			// 			if (isAttackerFaction && !unmatched.attackerFaction[vm.options.attacker.faction])
			// 			unmatched.attackerFaction[vm.options.attacker.faction] = { outIndex, key, item };
			// 			if (isDefenderFaction && !unmatched.defenderFaction[vm.options.defender.faction])
			// 			unmatched.defenderFaction[vm.options.defender.faction] = { outIndex, key, item };
			// 		});
			// 		});

			// 		return out;
			// 	};
			// },

			buildList() {
				const vm = this;

				return (source = {}) => {
					if (!source || typeof source !== 'object') return [];

					// Normalize source into an array of objects
					const sources = Array.isArray(source) ? source : [source];

					const out = [];
					const unmatched = {
					attackerOnly: null,
					defenderOnly: null,
					attackerFaction: {},
					defenderFaction: {}
					};

					sources.forEach(container => {
					const keys = Object.keys(container.group || container);

					keys.forEach(key => {
						const item = (container.group || container)[key];
						if (!item) return;

						// If item explicitly requests no pairing, remember it
						const noPair = item.noPairing === true;

						// Check availability (now fully wrapped per option)
						const aCan = typeof item.availableFor === 'function'
						? item.availableFor('attacker', vm.units?.attacker || {}, vm.unitsFull?.attacker || [], vm.battleType, vm.twilightsFall, vm.unitsVersion, vm, 1)
						: true;
						const dCan = typeof item.availableFor === 'function'
						? item.availableFor('defender', vm.units?.defender || {}, vm.unitsFull?.defender || [], vm.battleType, vm.twilightsFall, vm.unitsVersion, vm, 2)
						: true;

						if (!aCan && !dCan) return;

						// Determine category
						let isBoth = false;
						let isAttackerOnly = false;
						let isDefenderOnly = false;
						let isAttackerFaction = false;
						let isDefenderFaction = false;

						if (item.limitedToSide === 'attacker' && aCan) isAttackerOnly = true;
						else if (item.limitedToSide === 'defender' && dCan) isDefenderOnly = true;
						else if (item.limitedToFaction) {
						const fv = item.limitedToFaction;
						const attackerMatches = Array.isArray(fv)
							? fv.includes(vm.options.attacker.faction)
							: fv === vm.options.attacker.faction;
						const defenderMatches = Array.isArray(fv)
							? fv.includes(vm.options.defender.faction)
							: fv === vm.options.defender.faction;

						if (attackerMatches && aCan) isAttackerFaction = true;
						if (defenderMatches && dCan) isDefenderFaction = true;
						} else if (aCan && dCan) {
						isBoth = true;
						} else if (aCan) {
						isAttackerOnly = true;
						} else if (dCan) {
						isDefenderOnly = true;
						}

						// Pairing logic — skip pairing if this item or the unmatched candidate has noPairing
						if (isAttackerOnly && unmatched.defenderOnly) {
						const prev = unmatched.defenderOnly;
						if (!noPair && !(prev.item && prev.item.noPairing === true)) {
							out[prev.outIndex] = {
							pair: {
								[BattleSide.attacker]: { key, option: item },
								[BattleSide.defender]: { key: prev.key, option: prev.item }
							}
							};
							unmatched.defenderOnly = null;
							return;
						}
						}

						if (isDefenderOnly && unmatched.attackerOnly) {
						const prev = unmatched.attackerOnly;
						if (!noPair && !(prev.item && prev.item.noPairing === true)) {
							out[prev.outIndex] = {
							pair: {
								[BattleSide.attacker]: { key: prev.key, option: prev.item },
								[BattleSide.defender]: { key, option: item }
							}
							};
							unmatched.attackerOnly = null;
							return;
						}
						}

						if (isAttackerFaction && unmatched.defenderFaction[vm.options.defender.faction]) {
						const prev = unmatched.defenderFaction[vm.options.defender.faction];
						if (!noPair && !(prev.item && prev.item.noPairing === true)) {
							out[prev.outIndex] = {
							pair: {
								[BattleSide.attacker]: { key, option: item },
								[BattleSide.defender]: { key: prev.key, option: prev.item }
							}
							};
							delete unmatched.defenderFaction[vm.options.defender.faction];
							return;
						}
						}

						if (isDefenderFaction && unmatched.attackerFaction[vm.options.attacker.faction]) {
						const prev = unmatched.attackerFaction[vm.options.attacker.faction];
						if (!noPair && !(prev.item && prev.item.noPairing === true)) {
							out[prev.outIndex] = {
							pair: {
								[BattleSide.attacker]: { key: prev.key, option: prev.item },
								[BattleSide.defender]: { key, option: item }
							}
							};
							delete unmatched.attackerFaction[vm.options.attacker.faction];
							return;
						}
						}

						// Push single and track unmatched
						const outIndex = out.length;
						out.push({ key, option: item, cans: [aCan, dCan] });

						// Only record as unmatched if this item allows pairing
						if (!noPair) {
						if (isAttackerOnly && !unmatched.attackerOnly) unmatched.attackerOnly = { outIndex, key, item };
						if (isDefenderOnly && !unmatched.defenderOnly) unmatched.defenderOnly = { outIndex, key, item };
						if (isAttackerFaction && !unmatched.attackerFaction[vm.options.attacker.faction])
							unmatched.attackerFaction[vm.options.attacker.faction] = { outIndex, key, item };
						if (isDefenderFaction && !unmatched.defenderFaction[vm.options.defender.faction])
							unmatched.defenderFaction[vm.options.defender.faction] = { outIndex, key, item };
						}
					});
					});

					return out;
				};
				},





			maxSpend() {
				return this.buildList(MaxSpend);
			},

			technologies() {
				return this.buildList(Technologies);
			},

			actionCards() {
				return this.buildList(ActionCards);
			},

			leaders() {
				return this.buildList(Leaders);
			},
			genomes() {
				return this.buildList(Genomes);
			},
			battlefield() {
				return this.buildList(Battlefield);
			},
			otherComponents() {
				return this.buildList(OtherComponents);
			},
			faction() {
				return this.buildList(FactionSpecificOptions);
			},
			
			promissory() {
				return this.buildList(Promissory);
			},
			abilities() {
				return this.buildList(AbilitiesTwilightsFall);
			},
			unitUpgrades() {
				return this.buildList(UnitUpgradesTwilightsFall);
			},
			

			

			unitFleet() {				
				
				var dict = {'attacker':{}, 'defender':{}};
				dict.attacker = window.expandFleet(this, 'attacker');
				dict.defender = window.expandFleet(this,'defender');

				print(dict);
				

				return dict;
			},


			
			
			
			canvasWidth: function () {
				return window.CanvasSizes[this.canvasSize].width + 'px';
			},
			canvasHeight: function () {
				return window.CanvasSizes[this.canvasSize].height + 'px';
			},
		},
	});
	Vue.component('left-option', {
		props: ['optionName', 'option', 'options', 'side', 'units', 'units_full', 'battle_type', 'twilights_fall', 'units_version'],
		template: `
		<div class="o-grid__cell left-option" 
			:class="{ hidden: !option.availableFor(side, units[side], units_full[side], battle_type, twilights_fall, units_version, this, 3) }">
			<label v-bind:for="bindTarget + optionName" v-bind:title="option.description">
				{{ option.availableFor(side, units[side], units_full[side], battle_type, twilights_fall, units_version,  this, 4) ? option.name() : option.title }}
			</label>

			<!-- Numeric input with increment/decrement -->
			<div v-if="option.inputType === 'number'" class="c-input-group">
				<button type="button" class="c-button c-button--ghost-brand count-stepper" title="Decrement"
						@click="decrement()">-</button>
				<input type="number" v-model.number="modelTarget[optionName]" 
					v-bind:min="option.min" v-bind:max="option.max" v-bind:step="option.step">
				<button type="button" class="c-button c-button--ghost-brand count-stepper" title="Increment"
						@click="increment()">+</button>
			</div>

			<!-- Default checkbox -->
			<input v-else type="checkbox" v-bind:id="bindTarget + optionName"
				v-model="modelTarget[optionName]">
		</div>
		`,
		computed: {
			modelTarget() {
				if (this.option.under !== undefined){
					return this.options[this.side][this.option.under]
				}
				return this.options[this.side];
			},
			bindTarget(){
				if (this.option.under !== undefined){
					return this.side + '.' + this.option.under + '.';
				}
				return this.side + '.';
			}
		},
		methods: {
			increment() {
				if (this.options[this.side][this.optionName] == null) {
					this.options[this.side][this.optionName] = 0;
				}
				if (this.options[this.side][this.optionName] < this.option.max) {
					this.options[this.side][this.optionName] += this.option.step || 1;
				}
			},
			decrement() {
				if (this.options[this.side][this.optionName] == null) {
					this.options[this.side][this.optionName] = 0;
				}
				if (this.options[this.side][this.optionName] > this.option.min) {
					this.options[this.side][this.optionName] -= this.option.step || 1;
				}
			}
		}
	});
	Vue.component('right-option', {
		props: ['optionName', 'option', 'options', 'side', 'units', 'units_full', 'battle_type', 'twilights_fall', 'units_version'],
		template: `
		<div class="o-grid__cell right-option" 
			:class="{ hidden: !option.availableFor(side, units[side], units_full[side], battle_type, twilights_fall, units_version,  this, 5) }">
			<div v-if="option.inputType === 'number'" class="c-input-group">
				<button type="button" class="c-button c-button--ghost-brand count-stepper" title="Decrement"
						@click="decrement()">-</button>
				<input type="number" v-model.number=

				"modelTarget[optionName]" 

					v-bind:min="option.min" v-bind:max="option.max" v-bind:step="option.step">
				<button type="button" class="c-button c-button--ghost-brand count-stepper" title="Increment"
						@click="increment()">+</button>
			</div>
			<input v-else type="checkbox" v-bind:id=

			"bindTarget + optionName"
			v-model=
			
			"modelTarget[optionName]">

			<label v-bind:for=
			
			"bindTarget + optionName"

			v-bind:title="option.description">
				{{ option.availableFor(side, units[side], units_full[side], battle_type, twilights_fall, units_version, this, 6) ? option.name() : option.title }}
			</label>
		</div>
		`,
		computed: {
			modelTarget() {
				
				if (this.option.under !== undefined){
					return this.options[this.side][this.option.under]
				}
				return this.options[this.side];
			},
			bindTarget(){
				

				if (this.option.under !== undefined){
					return this.side + '.' + this.option.under + '.';
				}
				return this.side + '.';
			}
		},
		methods: {
			increment() {
				if (this.options[this.side][this.optionName] == null) {
					this.options[this.side][this.optionName] = 0;
				}
				if (this.options[this.side][this.optionName] < this.option.max) {
					this.options[this.side][this.optionName] += this.option.step || 1;
				}
			},
			decrement() {
				if (this.options[this.side][this.optionName] == null) {
					this.options[this.side][this.optionName] = 0;
				}
				if (this.options[this.side][this.optionName] > this.option.min) {
					this.options[this.side][this.optionName] -= this.option.step || 1;
				}
			}
		}
});

	// do not add colon to "side"
	Vue.component('option-pair', {
		props: ['optionName', 'option', 'options', 'pair', 'visible', 'units', 'units_full', 'battle_type', 'twilights_fall', 'units_version'],
		template:
		'<div class="o-grid center-grid" v-if="visible !== false">' +
		'	<left-option :option-name="option ? optionName : pair.attacker.key" :option="option || pair.attacker.option" :options="options" :units="units" :units_full="units_full" :battle_type="battle_type" side="attacker" :twilights_fall="twilights_fall" :units_version="units_version"></left-option>' +
		'	<help-mark v-if="option" :option="option" ></help-mark>' +
		'	<help-mark v-if="pair" :option="pair.attacker.option" :class="{ hidden: !pair.attacker.option.availableFor(\'attacker\', units.attacker, units_full.attacker, battle_type, twilights_fall, units_version, this, 7) }"></help-mark>' +
		'	<help-mark v-if="pair" :option="pair.defender.option" :class="{ hidden: !pair.defender.option.availableFor(\'defender\', units.defender, units_full.defender, battle_type, twilights_fall, units_version, this, 8) }"></help-mark>' +
		'	<right-option :option-name="option ? optionName : pair.defender.key" :option="option || pair.defender.option" :options="options" :units="units" :units_full="units_full" :battle_type="battle_type" side="defender" :twilights_fall="twilights_fall" :units_version="units_version"></right-option>' +
		'</div>',
	});
	Vue.component('help-mark', {
		props: ['option'],
		template:
		'<div class="o-grid__cell">' +
		'	<button type="button" class="help" v-bind:title="option.description" @click="showHelp"></button>' +
		'</div>',
		methods: {
			showHelp: function () {
				alert(this.option.name() + ':\n' + this.option.description);
			}
		}
	});

	app.applySectionRules();
	
	allHandler(app).handler();
	
	// app.recompute();
	

	

	function setFactionDefaults(battleSide, newFaction, input){

		for (var num in startingOptions[newFaction]){
			var tech= startingOptions[newFaction][num];
			input.options[battleSide][tech] = true;
		}

			// reset units
			
		for (var optionName in input.options[battleSide].units){
			input.options[battleSide].units[optionName] = false;
		}

		for (var unitName in startingUnits[newFaction]){
			
			var optionName= startingUnits[newFaction][unitName];
			input.options[battleSide].units[optionName] = true;
			
		}

		for (var optionName in input.options[battleSide].abilities){
			input.options[battleSide].abilities[optionName] = false;
		}

		for (var abilityName in startingAbilities[newFaction]){
			
			var optionName= startingAbilities[newFaction][abilityName];
			input.options[battleSide].abilities[optionName] = true;
			
		}
		
		if (newFaction === Faction.Neutral){
			
			input.units[battleSide][UnitType.Dreadnought].upgraded = true;
			input.units[battleSide][UnitType.Carrier].upgraded = true;
			input.units[battleSide][UnitType.Cruiser].upgraded = true;
			input.units[battleSide][UnitType.Destroyer].upgraded = true;
			input.units[battleSide][UnitType.Fighter].upgraded = true;
		}

	}


	/** When the faction changed from the faction having an upgrade for the unit (eg Sol Carrier)
	 * to the faction not having such upgrade, input flag for the unit upgrade should be set to false */
	function resetUpdatesAndTechnologies(battleSide, vm) {
		return function (newFaction, oldFaction) {
			
			vm = vm.app || vm;
			
			
			
			for (var unitType in UnitType) {
				var counter = vm.units[battleSide][unitType];
				
				if (!upgradeable(unitType, vm.unitsVersion[battleSide], vm.twilightsFall,vm.options[battleSide].faction)) {
					counter.upgraded = false;
				}
				if (!damageable(newFaction, unitType, counter.upgraded, vm.options[battleSide])) {
					counter.damaged = 0;
				}



			}

			const include = Object.keys(vm.currentOptions[battleSide]);
			// const include = vm.currentOptions.map(o => o.key));

			for (var group of Everything){
				for (var optionName in group){
					if (include.includes(optionName)) {

						const option = group[optionName];

						

						if (option.under === undefined){
							vm.options[battleSide][optionName] = option.default;
							
						} else {
							if (vm.options[battleSide][option.under] === undefined){
								vm.options[battleSide][option.under] = {}
								
							}
							
							vm.options[battleSide][option.under][optionName] = group[optionName].default;
						}
					}
				}
			}
			
			
			
			
			
			setFactionDefaults(battleSide, newFaction, vm);

			updateUnitsFullAll(vm).handler();
		};
	}

	function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		console.log(callNow);
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};


	function allHandler(vm){
		
		return {
			handler: function (){

				vm = vm.app || vm;

				
				if (vm.computing) return;

				vm.computing = true;
				
				
				setTimeout(function () {


				
					const keysNewA = Object.keys(vm.currentOptions.attacker);
					const keysOldA = Object.keys(vm.currentOptionsOld.attacker);

					
					
					const onlyInNewA = keysNewA.filter(obj => !keysOldA.includes(obj));
					const onlyInOldA = keysOldA.filter(obj => !keysNewA.includes(obj));

					const keysNewD = Object.keys(vm.currentOptions.defender);
					const keysOldD = Object.keys(vm.currentOptionsOld.defender);

					
					const onlyInNewD = keysNewD.filter(obj => !keysOldD.includes(obj));
					const onlyInOldD = keysOldD.filter(obj => !keysNewD.includes(obj));

				

					oneSide(BattleSide.attacker, onlyInNewA, onlyInOldA);
					oneSide(BattleSide.defender, onlyInNewD, onlyInOldD);

					function oneSide(battleSide, onlyInNew, onlyInOld){
						for (const key of onlyInNew){
							// print(key)
							const option = vm.currentOptions[battleSide][key].option;
							var place = option.under !== undefined ? vm.options[battleSide][option.under] : vm.options[battleSide];
							
							place[key] = option.default;
						}

						for (const key of onlyInOld){
							// print(key)
							const option = vm.currentOptionsOld[battleSide][key].option;
							var place = option.under !== undefined ? vm.options[battleSide][option.under] : vm.options[battleSide];
							place[key] = option.inputType === 'number' ? 0 : false;
						}

						
					}
					
					vm.breakdown =  vm.unitsFull;
					
				
					

					
					vm.recompute();
					
					vm.currentOptionsOld = structuredClone(vm.currentOptions);

					vm.handling= false;

				}, 15);

				
			},
			deep: true,
			
		}
		
	}

	

	function switchUpgrade(battleSide, unitType){
		return {
			handler: function(newVal, oldVal){
			
			var type = newVal ? 'upgraded' : 'base';
			this.unitsCanon[battleSide][unitType] = this.unitsVersion[battleSide][unitType][type].unit ||  this.unitsVersion[battleSide][unitType].base.unit;
		}};
	}

	function updateUnitsVersion(battleSide, unitType, unitName, upgrade) {
		return {

			handler: function (newVal, oldVal) {
				// print('trigger');

				var space = upgrade ?  UniqueUnitUpgradesOptions : UniqueUnitsOptions;
				var type = upgrade ? 'upgraded' : 'base';
				var otherType = upgrade ? 'base' : 'upgraded';

				if (newVal){
					
					

					this.unitsVersion[battleSide][unitType][type].unit = UniqueUnits[unitName].clone();
					this.unitsVersion[battleSide][unitType][type].name = unitName;

					
					for (const unitNameTemp in space){
						
						if (UniqueUnits[unitNameTemp].type === unitType && unitNameTemp !== unitName ){
							this.options[battleSide].units[unitNameTemp] = false;
						}
					}
				} else if (this.unitsVersion[battleSide][unitType][type].name === unitName){
					this.unitsVersion[battleSide][unitType][type].name = upgrade ? (StandardUpgrades[unitType] ? 'standardUpgrade': undefined) : 'standard';
					
					this.unitsVersion[battleSide][unitType][type].unit = upgrade ? (StandardUpgrades[unitType] ? StandardUpgrades[unitType].clone() : undefined) : StandardUnits[unitType].clone();
					
					
					
				}

				if (upgrade === this.units[battleSide][unitType].upgraded){
					this.unitsCanon[battleSide][unitType] = this.unitsVersion[battleSide][unitType][type].unit || this.unitsVersion[battleSide][unitType].base.unit;
				}
			}
		}
	}


	function updateUnitsFull(battleSide, unitType, reset, condition) {

		return {

			handler:  !reset ? function (newVal, oldVal) {
				
				
				if (condition === undefined || condition(this)){

					const diff = newVal-oldVal

					if (diff < 0) {
						window.removeUnit(this.unitsFull[battleSide], unitType, -1*diff, this.battleType, this.options[battleSide]);
					} else if (diff > 0) {
						// window.addUnit(this.unitsFull[battleSide], unitType, diff, 0, this.units[battleSide][unitType].upgraded, this.battleType, this.options[battleSide], this.units[battleSide]);
						window.addUnit(unitType, diff, this.unitsFull[battleSide], this.battleType, this.unitsCanon[battleSide], this.options[battleSide]);
					}
				}

				
				

				
				
			} : function () {

				
				if (condition === undefined || condition(this)){

					var count = this.units[battleSide][unitType].count;
				
					window.removeUnit(this.unitsFull[battleSide], unitType, count, this.battleType, this.options[battleSide]);

					// window.addUnit(this.unitsFull[battleSide], unitType, this.units[battleSide][unitType].count, this.units[battleSide][unitType].damaged, this.units[battleSide][unitType].upgraded, this.battleType, this.options[battleSide], this.units[battleSide]);

					window.addUnit(unitType, count, this.unitsFull[battleSide], this.battleType, this.unitsCanon[battleSide], this.options[battleSide], this.units[battleSide][unitType].damaged);
				}

				

			},

			
			// deep: true
		}
	}
	function updateUnitsFullAll(vm) {

		return {

			handler: function () {

				vm = vm.app || vm;
				
				for (const battleSide of ['attacker', 'defender']){
					
					for (const unitType in UnitType){

						const count = vm.units[battleSide][unitType].count
					
						window.removeUnit(vm.unitsFull[battleSide], unitType, count, vm.battleType, vm.options[battleSide]);

						

						window.addUnit(unitType, count, vm.unitsFull[battleSide], vm.battleType, vm.unitsCanon[battleSide], vm.options[battleSide], vm.units[battleSide][unitType].damaged);

						
						
					}
				}
				// this.breakdown =  this.unitsFull;
			},

			
			deep: true
		}
	}

	// function test(string){
	// 		return {
	// 			handler: function () {
	// 				print(string);
					
	// 			},
	// 			deep: true
	// 		}
	// 	}

	function getInput() {
		const output = mergeDeep(getDefaultInput(), getPersistedInput());
		
		return output;

		function isObject(item) {
			return (item && typeof item === 'object' && !Array.isArray(item));
		}

		function mergeDeep(target, ...sources) {
			if (!sources.length) return target;
			const source = sources.shift();

			if (isObject(target) && isObject(source)) {
				for (const key in source) {
					if (isObject(source[key])) {
						if (!target[key]) Object.assign(target, { [key]: {} });
						mergeDeep(target[key], source[key]);
					} else {
						Object.assign(target, { [key]: source[key] });
					}
				}
			}

			return mergeDeep(target, ...sources);
		}
	}

	function getDefaultInput() {
		var result = {
			battleType: BattleType.Space,
			units:{
				attacker: {},
				defender: {},
			},
			options: {
				attacker: {
					faction: Faction.Arborec,
				}, 
				defender: {
					faction: Faction.Arborec,
				},
			},
			canvasSize: 0,
		};

		result.currentOptionsOld = {
			attacker:{},
			defender:{}
		};
		
		// SECTION_NAMES



		for (var group of Everything){
			for (var optionName in group){
				const option = group[optionName];

				

				if (option.under === undefined){
					result.options.attacker[optionName] = option.default;
					result.options.defender[optionName] = option.default;
				} else {
					if (result.options.attacker[option.under] === undefined){
						result.options.attacker[option.under] = {}
						
					}
					if (result.options.defender[option.under] === undefined){
						result.options.defender[option.under] = {}
						
					}
					result.options.attacker[option.under][optionName] = group[optionName].default;
					result.options.defender[option.under][optionName] = group[optionName].default;
				}
				// if ((option.limitedToSide === undefined || option.limitedToSide === BattleSide.attacker) && ){
				// 	result.currentOptionsOld.attacker[optionName]={
				// 		option:{
				// 			default: option.default,
				// 			under: option.under,
				// 			inputType: option.inputType
				// 		}
				// 	}
				// }
				// if (option.limitedToSide === undefined || option.limitedToSide === BattleSide.defender){
				// 	result.currentOptionsOld.defender[optionName]={
				// 		option:{
				// 			default: option.default,
				// 			under: option.under,
				// 			inputType: option.inputType
				// 		}
				// 	}
				// }
				
			}
		}

		
		result.options.attacker.maxSpend= 0;
		result.options.defender.maxSpend= 0;
		
		
		
		result.unitsVersion = {attacker:{}, defender:{}};
		result.unitsCanon = {attacker:{}, defender:{}};
		for (var unitType in UnitType) {
			result.units.attacker[unitType] = { 
				count: 0, 
				upgraded: false, 
				damaged: 0, 
			};
			result.units.defender[unitType] = { 
				count: 0, 
				upgraded: false, 
				damaged: 0,  
			};

			result.unitsVersion.attacker[unitType] = {
				base: {
					name: 'standard',
					unit: StandardUnits[unitType].clone(),
				},
				upgraded: {
					name: StandardUpgrades[unitType] ? 'standardUpgrade' : undefined,
					unit: StandardUpgrades[unitType] ? StandardUpgrades[unitType].clone() : undefined,
				},
			}
			result.unitsVersion.attacker[unitType].upgraded.unit = result.unitsVersion.attacker[unitType].upgraded.unit ? result.unitsVersion.attacker[unitType].upgraded.unit : result.unitsVersion.attacker[unitType].base.unit;

			result.unitsVersion.defender[unitType] = {
				base: {
					name: 'standard',
					unit: StandardUnits[unitType].clone(),
				},
				upgraded: {
					name: StandardUpgrades[unitType] ? 'standardUpgrade' : undefined,
					unit: StandardUpgrades[unitType] ? StandardUpgrades[unitType].clone() : undefined,
				},
			}
			result.unitsVersion.defender[unitType].upgraded.unit = result.unitsVersion.defender[unitType].upgraded.unit ? result.unitsVersion.defender[unitType].upgraded.unit : result.unitsVersion.defender[unitType].base.unit;

			result.unitsCanon.attacker[unitType] = result.unitsVersion.attacker[unitType].base.unit;
			result.unitsCanon.defender[unitType] = result.unitsVersion.defender[unitType].base.unit;
		}

		
		
		setFactionDefaults('attacker', Faction.Arborec, result);
		setFactionDefaults('defender', Faction.Arborec, result);

		result.unitsFull = {attacker:{}, defender:{}};
		result.unitsFull.attacker = window.expandFleet(result.options, BattleType.Space, 'attacker', result.units.attacker);
		result.unitsFull.defender = window.expandFleet(result.options, BattleType.Space, 'defender', result.units.defender);


		
		

		

		
		
		result.twilightsFall = false;
		
		return result
	}

	function persistInput() {
		if (localStorage) {
			var inputToSave = JSON.parse(JSON.stringify(input));
			for (var viewOnlyProperty in transientProperties) {
				delete inputToSave[viewOnlyProperty];
			}
			
			
			localStorage.setItem('ti4calc/input', JSON.stringify(inputToSave));
			return true;
		}
		return false;
	}
	function getPersistedInput() {
		if (!localStorage) return null;
		var resultString = localStorage.getItem('ti4calc/input');
		if (!resultString) return null;
		var result = JSON.parse(resultString);
		
		
		for (var unitType in UnitType) {
			// because previous published version didn't have already damaged units, persisted input might miss these fields
			
			result.units.attacker[unitType].damaged = result.units.attacker[unitType].damaged || 0;
			result.units.defender[unitType].damaged = result.units.defender[unitType].damaged || 0;


		}
		
		var temp = []
		for (const unit of result.unitsFull.attacker){
			
			const newUnit = new window.UnitInfo(unit.type, unit);
			
			temp.push(newUnit);
			// temp.push(unit.clone());
		}
		result.unitsFull.attacker = temp;
		
		var tempD = []
		for (const unit of result.unitsFull.defender){
			const newUnit = new window.UnitInfo(unit.type, unit);
			
			tempD.push(newUnit);
		}
		result.unitsFull.defender = tempD;

		
		
		
		for (var unitType in UnitType){

			
			result.unitsVersion.attacker[unitType].base.unit = new window.UnitInfo(unitType, result.unitsVersion.attacker[unitType].base.unit);
			result.unitsVersion.attacker[unitType].upgraded.unit = new window.UnitInfo(unitType, result.unitsVersion.attacker[unitType].upgraded.unit);
			
			result.unitsCanon.attacker[unitType] = result.units.attacker[unitType].upgraded ? result.unitsVersion.attacker[unitType].upgraded.unit : result.unitsVersion.attacker[unitType].base.unit;
			
			result.unitsVersion.defender[unitType].base.unit = new window.UnitInfo(unitType, result.unitsVersion.defender[unitType].base.unit);
			result.unitsVersion.defender[unitType].upgraded.unit = new window.UnitInfo(unitType, result.unitsVersion.defender[unitType].upgraded.unit);
			
			result.unitsCanon.defender[unitType] = result.units.defender[unitType].upgraded ? result.unitsVersion.defender[unitType].upgraded.unit : result.unitsVersion.defender[unitType].base.unit;
			
		}
		
		
		

		// setFactionDefaults('attacker', result.options.attacker.faction, result);
		// setFactionDefaults('defender', result.options.defender.faction, result);
		
		
		
		return result;
	}
	function print(obj) {
		// Get the current stack trace to find the line where the function is called
		const stack = new Error().stack;
		const stackLines = stack.split("\n");
		
		// Get the line number from the stack trace
		const match = stackLines[1].match(/(?:\()?(.*):(\d+):\d+\)?$/);
		const fileName = match ? match[1].split('/').pop() : 'unknown';
		const lineNumber = match ? match[2] : 'unknown';
		
		// Check if the object is undefined or null and print accordingly
		if (obj === undefined || obj === null) {
			console.log(`${obj} at ${fileName}:${lineNumber}`);
		} else {
			// If the object is neither null nor undefined, print a copy of the object
			console.log(JSON.parse(JSON.stringify(obj)), `at ${fileName}:${lineNumber}`);
		}
	}









	






















})();