(function (root) {
	root.dieSides = 10;

	root.BattleType = {
		Space: 'Space',
		Ground: 'Ground',
	};

	root.BattleSide = {
		attacker: 'attacker',
		defender: 'defender',
		opponent: function (battleSide) {
			return {
				attacker: 'defender',
				defender: 'attacker',
			}[battleSide];
		}
	};

	root.SideUnits = {
		attacker: 'attackerUnits',
		defender: 'defenderUnits',
	};
	var UnitType = {
		Flagship: 'Flagship',
		WarSun: 'WarSun',
		Dreadnought: 'Dreadnought',
		Cruiser: 'Cruiser',
		Carrier: 'Carrier',
		Destroyer: 'Destroyer',
		Fighter: 'Fighter',
		Mech: 'Mech',
		Infantry: 'Infantry',
		PDS: 'PDS',
		SpaceDock: 'SpaceDock'
		// Planet: 'Planet',
	};
	
	root.UnitType = UnitType;

	var shortUnitType = {
		Flagship: 'X',
		WarSun: 'W',
		Dreadnought: 'D',
		Cruiser: 'C',
		Destroyer: '+',
		Carrier: 'V',
		Fighter: 'F',
		Mech: 'M',
		Infantry: 'I',
		PDS: 'P',
		SpaceDock: 'S',


		GhostHit:'T',
		// Planet: 'J'
	};

	root.Faction = {
		Arborec: 'Arborec',
		Creuss: 'Creuss',
		Hacan: 'Hacan',
		JolNar: 'JolNar',
		L1Z1X: 'L1Z1X',
		Barony: 'Barony',
		Mentak: 'Mentak',
		Muaat: 'Muaat',
		Naalu: 'Naalu',
		Saar: 'Saar',
		Sardakk: 'Sardakk',
		Sol: 'Sol',
		Nekro: 'Nekro',
		Winnu: 'Winnu',
		Xxcha: 'Xxcha',
		Yin: 'Yin',
		Yssaril: 'Yssaril',
		Argent: 'Argent',
		Empyrean: 'Empyrean',
		Mahact: 'Mahact',
		NaazRokha: 'NaazRokha',
		Nomad: 'Nomad',
		Titans: 'Titans',
		Cabal: 'Cabal',
		Keleres: 'Keleres',
		Bastion: 'Bastion',
		RalNel: 'RalNel',
		Deepwrought: 'Deepwrought',
		Crimson: 'Crimson',
		Firmament: 'Firmament',
		Neutral: 'Neutral',

	};

	root.FactionsDisplayNames = {
		Arborec: 'Arborec',
		Creuss: 'Creuss',
		Hacan: 'Hacan',
		JolNar: 'Jol-Nar',
		L1Z1X: 'L1Z1X',
		Barony: 'Barony',
		Mentak: 'Mentak',
		Muaat: 'Muaat',
		Naalu: 'Naalu',
		Nekro: 'Nekro Virus',
		Saar: 'Saar',
		Sardakk: 'Sardakk N\'orr',
		Sol: 'Sol',
		Winnu: 'Winnu',
		Xxcha: 'Xxcha',
		Yin: 'Yin',
		Yssaril: 'Yssaril',
		Argent: 'Argent Flight',
		Empyrean: 'Empyrean',
		Mahact: 'Mahact',
		NaazRokha: 'Naaz-Rokha',
		Nomad: 'Nomad',
		Titans: 'Titans of Ul',
		Cabal: 'Vuil\'Raith',
		Keleres: 'Council Keleres',
		Bastion: 'Last Bastion',
		RalNel: 'Ral Nel',
		Deepwrought: 'Deepwrought',
		Crimson: 'Crimson',
		Firmament: 'Firmament/Obsidian',
		Neutral: 'Neutral',
	};

	root.FactionsDisplayNames_TF = {
		
		Red: 'Ruby Monarch (Red)',
		Orange: 'Radiant Aur (Orange)',
		Yellow: 'Avarice Rex (Yellow)',
		Green: 'Herald (Green)',
		Blue: 'Saint of Swords (Blue)',
		Purple: 'Il Na Viroset (Purple)',
		Pink: 'El Nen Janovet (Pink)',
		Black: 'Lurch (Black)',

		Neutral: 'Neutral',
		
	};

	

	function OptionGroup(group, { limitedToFaction, limitedToSide, limitedToUnit, limitedToBattle, limitedToSetting, limitedToUnitAbility } = {}) {
		// Save metadata
		this.limitedToFaction = limitedToFaction;
		this.limitedToSide = limitedToSide;
		this.limitedToUnit = limitedToUnit;
		this.limitedToBattle = limitedToBattle;
		this.limitedToSetting = limitedToSetting;
		this.limitedToUnitAbility = limitedToUnitAbility;

		// We'll build a new group object that contains COPIES of the provided options
		this.group = {};

		// Helper: copy an object preserving prototype and property descriptors
		function shallowClonePreserveProto(obj) {
			if (obj === null || typeof obj !== 'object') return obj;
			const proto = Object.getPrototypeOf(obj);
			const copy = Object.create(proto);
			const descriptors = Object.getOwnPropertyDescriptors(obj);
			Object.defineProperties(copy, descriptors);
			return copy;
		}

		// Iterate the original group and clone each option into this.group
		Object.keys(group || {}).forEach(key => {
			const originalOption = group[key];
			if (originalOption === null || typeof originalOption !== 'object') {
			// primitive or missing — just copy as-is
			this.group[key] = originalOption;
			return;
			}

			// make a shallow copy that preserves prototype and descriptors
			const optionCopy = shallowClonePreserveProto(originalOption);

			// capture the original availableFor function (if any)
			const originalAvailableFor = originalOption.availableFor;

			if (typeof originalAvailableFor === 'function') {
			// Make a new availableFor on the copy that:
			//  - calls the original logic with `this` bound to the copy (so any this.* works)
			//  - ANDs that result with the group's availableFor
			optionCopy.availableFor = function (battleSide, thisSideUnitsCounters, thisSideUnitsFull, battleType, twilightsFall, thisSideUnitsVersion, input, test) {
				// originalAvailableFor may use `this`, so call with `optionCopy` as `this`
				const itemAllows = !!originalAvailableFor.call(optionCopy, battleSide, thisSideUnitsCounters, thisSideUnitsFull, battleType,  twilightsFall, thisSideUnitsVersion, input, 0);
				const groupAllows = !!OptionGroup.prototype.availableFor.call(/* group context = */ this, battleSide, thisSideUnitsCounters, thisSideUnitsFull, battleType,  twilightsFall, thisSideUnitsVersion, input,0);
				return itemAllows && groupAllows;
			}.bind(this); // ensure inner call to OptionGroup.prototype.availableFor has correct "this"
			} else {
			// If the option lacked availableFor, create one that respects only the group
			optionCopy.availableFor = function (battleSide, thisSideUnitsCounters, thisSideUnitsFull, battleType,  twilightsFall, thisSideUnitsVersion, input, test) {
				return !!OptionGroup.prototype.availableFor.call(this, battleSide, thisSideUnitsCounters, thisSideUnitsFull, battleType,  twilightsFall, thisSideUnitsVersion, input, 0);
			}.bind(this);
			}

			// Put the copy into the group's map
			this.group[key] = optionCopy;
		});
	}



	Object.byString = function(o, s) {
		s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
		s = s.replace(/^\./, '');           // strip a leading dot
		var a = s.split('.');
		for (var i = 0, n = a.length; i < n; ++i) {
			var k = a[i];
			if (k in o) {
				o = o[k];
			} else {
				return;
			}
		}
		return o;
	}
	Object.secondProperties = function(o){
		var output = [];
		for (var options in o){
			for (var option in o[options]){
				output += o[options][option];
			}
		}
		return output;
	}

	OptionGroup.prototype.availableFor = function (battleSide, thisSideUnitsCounters, thisSideUnitsFull, battleType, twilightsFall,   thisSideUnitsVersion, input, test){

		
		
		var limitedToSettingsCondition = evaluateSettingExpression(this.limitedToSetting,input,  battleSide, root);
		//{limitedToSetting:"options.[side].faction!=='Empyrean'||units.[side].Flagship.count===0"}),

		
		
		
		var condition = (this.limitedToSide === undefined || this.limitedToSide === battleSide) && 
						(this.limitedToUnit === undefined || thisSideUnitsCounters[this.limitedToUnit].count>0) &&
						(this.limitedToBattle === undefined || this.limitedToBattle === battleType) &&
						(this.limitedToSetting === undefined || limitedToSettingsCondition) &&
						(this.limitedToFaction === undefined || input.options[battleSide].faction === this.limitedToFaction);
		
		

		if (this.limitedToUnitAbility && this.limitedToUnitAbility.startsWith('!')){
			var temp = this.limitedToUnitAbility.slice(1);
			condition = condition && thisSideUnitsFull.every( obj => !obj.abilities.includes(temp));
		} else if (this.limitedToUnitAbility){
			condition = condition && thisSideUnitsFull.some( obj => obj.abilities.includes(this.limitedToUnitAbility));
		}

		return condition;
	}

	function Option(title, description, {limitedToFaction, limitedToSide, limitedToUnit, limitedToBattle, limitedToSetting, limitedToUnitAbility, limitedToMode, limitedToUpgradeable, inputType, min, max, step, def, under, orMode, noPairing, exclusive} = {}) {
		this.title = title; 
		this.description = description;
		this.limitedToFaction = limitedToFaction;
		this.limitedToSide = limitedToSide; // this option only appears to this side of the battle ('attacker')
		this.limitedToUnit = limitedToUnit; // this option only appears if there is at least 1 of this participating on its side ('Mech')
		this.limitedToBattle = limitedToBattle; // this option only appears for this kind of battle ('Ground')
		this.limitedToSetting = limitedToSetting; // this option only appears if this setting is true ('defender.units.Infantry.upgraded')
		this.limitedToUnitAbility = limitedToUnitAbility;
		// this.mutual = mutual; // this forces other option to be false if it is true ('moraleBoost')

		this.limitedToMode = limitedToMode;

		this.limitedToUpgradeable = limitedToUpgradeable;

		this.orMode = orMode || false;

		this.inputType = inputType || 'checkbox'; // 'checkbox' or 'number'
		this.min = min || 0;
		this.max = max || 4;
		this.step = step || 1;

		this.default = def || (this.inputType === 'number' ? 0 : false);

		this.under = under || undefined;

		this.noPairing = noPairing || false;

		this.exclusive = exclusive || [];
	}
	Object.byString = function(o, s) {
		s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
		s = s.replace(/^\./, '');           // strip a leading dot
		var a = s.split('.');
		for (var i = 0, n = a.length; i < n; ++i) {
			var k = a[i];
			if (k in o) {
				o = o[k];
			} else {
				return;
			}
		}
		return o;
	}
	Object.secondProperties = function(o){
		var output = [];
		for (var options in o){
			for (var option in o[options]){
				output += o[options][option];
			}
		}
		return output;
	}
	Option.prototype.availableFor = function (battleSide, thisSideUnitsCounters, thisSideUnitsFull, battleType, twilightsFall, unitsVersion, input, test, test2){

		// console.log(input);
		// print(test);
		// print([battleSide, thisSideUnitsCounters, thisSideUnitsFull, battleType, twilightsFall, thisSideUnitsVersion])
		// print(input.unitsFull)

		// console.log(input)
		
		
		if (input.unitsFull === undefined){
			input.unitsFull = {}
		}
		input.unitsFull[battleSide] = thisSideUnitsFull;

		if (input.unitsVersion === undefined){
			input.unitsVersion = {}
		}
		input.unitsVersion[battleSide] = unitsVersion[battleSide];
		
		
		
		input.battleType = battleType;
			
		
		
		
		var limitedToSettingsCondition = evaluateSettingExpression(this.limitedToSetting,input,  battleSide, root);
	
		//{limitedToSetting:"options.[side].faction!=='Empyrean'||units.[side].Flagship.count===0"}),

		
		
		
		
		// var condition = (this.limitedToSide === undefined || this.limitedToSide === battleSide) && 
		// 				(this.limitedToUnit === undefined || thisSideUnitsCounters[this.limitedToUnit].count>0) &&
		// 				(this.limitedToBattle === undefined || this.limitedToBattle === battleType) &&
		// 				(this.limitedToSetting === undefined || limitedToSettingsCondition) &&
		// 				(this.limitedToFaction === undefined || input.options[battleSide].faction === this.limitedToFaction) &&
		// 				(this.limitedToMode === undefined || (twilightsFall && this.limitedToMode === 'twilight') || (!twilightsFall && this.limitedToMode === 'standard'));


		function addCondition(list, value, fn) {
			
			if (value !== undefined) list.push(fn(value));
		}

		let conditions = [];

		// Build the conditions dynamically
		addCondition(conditions, this.limitedToSide, v => v === battleSide);

		addCondition(conditions, this.limitedToUnit, v =>
			thisSideUnitsCounters[v].count > 0
		);

		addCondition(conditions, this.limitedToBattle, v =>
			v === battleType
		);

		addCondition(conditions, this.limitedToSetting, v =>
			limitedToSettingsCondition
		);

		addCondition(conditions, this.limitedToFaction, v =>
			input.options[battleSide].faction === v
		);

		addCondition(conditions, this.limitedToMode, v =>
			(twilightsFall && v === "twilight") ||
			(!twilightsFall && v === "standard")
		);

		addCondition(conditions, this.limitedToUnitAbility, v => {
			if (typeof v !== "string") return false; // defensive
			if (v.startsWith("!")) {
				const temp = v.slice(1);
				return thisSideUnitsFull.every(obj => !obj.abilities.includes(temp));
			} else {
				return thisSideUnitsFull.some(obj => obj.abilities.includes(v));
			}
		});
		
		

		addCondition(conditions, this.limitedToUpgradeable, v =>
			root.upgradeable(this.limitedToUpgradeable, unitsVersion[battleSide], twilightsFall)
		);


		const evaluate = this.orMode
			? () => conditions.some(fn => fn)
			: () => conditions.every(fn => fn);

		let condition = evaluate();
		
		// if (this.title === 'Reflective Shielding' && battleSide === root.BattleSide.defender){
		// 	print(condition);
		// 	print(limitedToSettingsCondition);
		// 	print(input.battleType);
		// 	print(input.options.defender.units);
		// 	print(test);
		// 	print('done');
			
		// }

		
		if (this.title === 'Max TGs Spend'){
			condition = condition && (
				thisSideUnitsFull.some(obj => obj.abilities.some(a => a === "hacanFlagship")) ||
				thisSideUnitsFull.some(obj => obj.abilities.some(a => a === "empyreanFlagship")) ||
				input.options[battleSide].empyreanFlagshipSupport ||
				input.options[battleSide].useForesight ||
				input.options[battleSide].revealPrototype ||
				(input.options[battleSide].orangeMechRepairsOne) || 
				(input.options[battleSide].orangeMechRepairsHalf) || 
				(input.options[battleSide].orangeMechRepairsAll) ||
				(input.options[battleSide].abilities.indoctrination) ||
				(input.options[battleSide].munitionsReservesOnceRound) || 
				(input.options[battleSide].munitionsReservesEveryRound)
			);
			
			
		}

		

		
		return condition;
	};
	Option.prototype.name = function () {
		return this.title;
	};
	
	Option.prototype.noII = function(){
		var output = new Option(this.title, this.description, {...this});
		output.title = output.title.replace(/II/g, "");
		return output;
	}
	Option.prototype.addSin = function(){
		var output = new Option(this.title, this.description, {...this});
		output.limitedToSetting = output.limitedToSetting + '&&(options.[side].abilities.singularityX||options.[side].abilities.singularityY||options.[side].abilities.singularityZ)'
		output.noPairing = true;

		return output;
	}
	Option.prototype.update = function(changes){
		// Object.assign(this, changes);
		// return this;
		const updated = { ...this, ...changes };
		return new Option(updated.title, updated.description, updated);
	}

	root.MaxSpend = {
		maxSpend: new Option('Max TGs Spend', 'Maximum Trade Goods you are willing to spend', {inputType:'number', max:15, def: 4}),
	}

	

	root.Abilities = {
		ambush: new Option('Ambush (Mentak)', "At the start of a space combat, you may roll 1 die for each of up to 2 of your cruisers or destroyers in the system.  For each result equal to or greater than that ship's combat value, produce 1 hit; your opponent must assign it to 1 of their ships", {
				limitedToBattle: root.BattleType.Space,
		}),

		foresight: new Option('Foresight (Naalu)', "After another player moves ships into a system that contains 1 or more of your ships, you may place 1 token from your strategy pool in an adjacent system that does not contain another player's ships;  move your ships from the active system into that system", {
				limitedToBattle: root.BattleType.Space,
		}),

		foresightTF: new Option('Foresight (Naalu)', "Retreat immediately after another player moves ships into the active system", {
				limitedToBattle: root.BattleType.Space,
		}),

		harrow: new Option('Harrow (L1Z1X)', "At the end of each round of ground combat, your ships in the active system may use their Bombardment abilities against your opponent's ground forces on the planet",{
			limitedToBattle:root.BattleType.Ground,
		}),

		indoctrination: new Option('Indoctrination (Yin)', "At the start of ground combat, spend 2 influence to replace an opponent's infantry with your own", {
				limitedToBattle: root.BattleType.Ground,
		}),

		mini: new Option('Miniaturization (Ral Nel)', "While your structures are in the space area, they cannot use their unit abilities"),

		munitionsReserves: new Option('Munitions Reserves (Barony)', "At the start of each space combat round, spend 2 trade goods to reroll your combat dice", {
				limitedToBattle: root.BattleType.Space,
		}),

		planesplitter: new Option('Planesplitter (Firmament)', "Apply +2 to your unit's combat rolls (from the fracture)"),

		propagation: new Option('Propagation (Nekro)', "You cannot research technology"),

		proximaTargetingTF: new Option('Proxima Targeting VI (Bastion)', "At the start of each ground combat round, resolve Bombardment 7(x3) againt you and the opponent. Cancel 1 Bombardment hit always", {
				limitedToBattle: root.BattleType.Ground,
		}),

		raidFormation: new Option('Raid Formation (Argent)', "When 1 or more of your units uses ANTI-FIGHTFR BARRAGE, for each hit produced in excess of your opponent's Fighters, choose 1 of your opponent's ships that has SUSTAIN DAMAGE to become damaged", {
				limitedToBattle: root.BattleType.Space,
		}),

		singularity: new Option('Technological Singularity (Nekro)', "Once per combat, after 1 of your opponent's units is destroyed, you may gain 1 technology that is owned by that player"),

		singularityX: new Option('Singularity X (Nekro)', "Once per combat, after 1 of your opponent's units is destroyed, you may copy 1 ability from that player"),
		singularityY: new Option('Singularity Y (Nekro)', "Once per combat, after 1 of your opponent's units is destroyed, you may copy 1 ability from that player"),
		singularityZ: new Option('Singularity Z (Nekro)', "Once per combat, after 1 of your opponent's units is destroyed, you may copy 1 ability from that player"),

		smotheringPresence: new Option('Smothering Presense (Crimson)', "Your structures in or adjacent to the active system prevent the opponent from using unit abilities"),

		superchargeTF: new Option('Supercharge (Argent)', "Apply +2 to one of your units combat rolls during each combat round"),
		
		
		unrelenting: new Option('Unrelenting (Sardakk)', "Apply +1 to your unit's combat rolls"),

	}
	for (const [key, value] of Object.entries(root.Abilities)) {
    	value.under = 'abilities';
	}

	root.Upgrades = Object.fromEntries(
		Object.values(root.UnitType).map(unit => {
			const prop = `upgrade${unit}`;
			return [prop,
			new Option(
				`Upgrade ${unit}`,
				`Gain your ${unit} upgrade technology`,
				{
				limitedToMode: 'standard',
				limitedToSetting: `options.[side].revealPrototype&&!units.[side].${unit}.upgraded`,
				limitedToUpgradeable: root.UnitType[unit],
				noPairing: true,
				}
			)
			];
		})
	);
	
	root.ActionCards = {
		moraleBoost: new Option('Morale Boosts', 'Apply +1 to combat rolls during combat round', {
			inputType:'number', 
			limitedToMode:'standard'
		}),

		maneuveringJets: new Option('Maneuvering Jets', 'Cancel 1 Space Cannon hit', {
			inputType:'number', 
			limitedToMode:'standard'
		}),

		shieldsHolding: new Option('Shields Holding', 'Cancel 2 hits, during space combat', {
			inputType:'number', 
			limitedToMode:'standard',
			limitedToBattle: root.BattleType.Space,
		}),

		directHit: new Option('Direct Hits', "After another player's ship uses Sustain Damage, destroy that ship", {
			inputType:'number', 
			limitedToMode:'standard',
			limitedToSetting: 'options.[side].units.naazRokhaMechII||battleType==="Space"'
		}),
		riskDirectHit: new Option('Risk Direct Hits', 'Damage ships vulnerable to Direct Hit before killing off fodder', {
			def : true, 
			limitedToMode:'standard',
			limitedToSetting: 'options.[side].units.naazRokhaMechII||battleType==="Space"'
		}),


		bunker: new Option('Bunker', 'Apply -4 to all bombardment rolls', {
			limitedToMode:'standard', 
			limitedToSide:root.BattleSide.defender, 
			limitedToBattle: root.BattleType.Ground,
		}),
		courageous: new Option('Courageous to the End', "After your first ship is destroyed, roll twice for its combat value, and destroy an opponent's ship for each success", {
			limitedToBattle: root.BattleType.Space, 
			limitedToMode:'standard'
		}),
		disable: new Option('Disable', 'Opponent\'s PDS lose Planetary Shield and Space Cannon', {
			limitedToMode:'standard', 
			limitedToSide:root.BattleSide.attacker, 
			limitedToBattle: root.BattleType.Ground,
		}),
		emergencyRepairs: new Option('Emergency Repairs', 'At the start or end of a round, repair all your  units', {
			limitedToMode:'standard', 
		}),
		emergencyRepairsHalf: new Option('Emergency Repairs Half', 'Use Emergency Repairs when half (rounded up) of your units are damaged', {
			limitedToMode:'standard', 
			limitedToSetting: 'options.[side].emergencyRepairs'
		}),
		emergencyRepairsAll: new Option('Emergency Repairs All', 'Use Emergency Repairs when all of your units are damaged', {
			limitedToMode:'standard', 
			limitedToSetting: 'options.[side].emergencyRepairs'
		}),

		experimental: new Option('Experimental Battlestation', 'Your Space Dock uses Space Cannon 5(x3) during Space Cannon Offense', {
			limitedToMode:'standard',
			limitedToBattle: root.BattleType.Space,
		}),

		fighterPrototype: new Option('Fighter Prototype', 'Apply +2 to fighter\'s combat rolls during first combat round', {
			limitedToMode:'standard',
			limitedToBattle: root.BattleType.Space, 

		}),

		fireTeam: new Option('Fire Team', 'Reroll your Ground Forces\' combat rolls, during a ground combat round', {
			limitedToMode:'standard',
			limitedToBattle: root.BattleType.Ground, 

		}),

		intercept: new Option('Intercept', "Stop your opponent from retreating once", {
			limitedToBattle: root.BattleType.Space, 
			limitedToMode:'standard'
		}),

		skilledRetreat: new Option('Skilled Retreat', "Retreat at the start of space combat", {
			limitedToBattle: root.BattleType.Space, 
			limitedToMode:'standard'
		}),

		// codex 1

		blitz: new Option('Blitz', "Your non-fighter ships without Bombardment gain Bombardment 6", {
			limitedToBattle: root.BattleType.Ground, 
			limitedToSide: root.BattleSide.attacker, 
			limitedToMode:'standard'
		}),

		reflectiveShielding: new Option('Reflective Shielding', "When your ship uses Sustain Damage, produce 2 hits", {
			limitedToMode:'standard',
			limitedToSetting: 'options.[side].units.naazRokhaMechII||battleType==="Space"'
		}),

		// scramble: new Option('Scramble Frequency', "Reroll your opponent Space Cannon, Bombardment, or Barrage roll if they got too many hits", {
		// 	limitedToMode:'standard',

		// }),

		solarFlare: new Option('Solar Flare', "Opponent cannot use Space Cannon during Space Cannon Offense", {
			limitedToMode:'standard',
			limitedToBattle: root.BattleType.Space,

		}),
		
		// pok

		revealPrototype: new Option('Reveal Prototype', "Research a unit upgrade that matches a participating unit at the start of combat", {
			limitedToMode:'standard',
			limitedToSetting: '!options.[side].abilities.propagation',
		}),


		...root.Upgrades,
		
		rout: new Option('Rout', "Force the Attacker to retreat, if able", {
			limitedToBattle: root.BattleType.Space, 
			limitedToSide:root.BattleSide.defender, 
			limitedToMode:'standard'
		}),

		waylay: new Option('Waylay', "Barrage hits are assigned to all opponent units", {
			limitedToBattle: root.BattleType.Space, 
			limitedToMode:'standard'
		}),





		
		// twilights fall
		

		hardlight: new Option('Hardlights', 'Cancel 2 hits', {
			inputType:'number', 
			limitedToMode:'twilight',
			max: 2,
		}),

		spark: new Option('Sparks', "After another player's unit uses Sustain Damage, destroy it", {
			inputType:'number', 
			limitedToMode:'twilight',
			max: 2,
		}),

		riskSpark: new Option('Risk Spark', 'Damage units vulnerable to Direct Hit before killing off fodder', {
			def : true, 
			limitedToMode:'twilight'
		}),

		atomize: new Option('Atomize', "Destroy all units when your flagship is destroyed", {
			limitedToBattle: root.BattleType.Space, 
			limitedToMode:'twilight'
		}),

		converge: new Option('Converge', "Space Cannon hits must be applied to non-fighter ships or mechs", {
			
			limitedToMode:'twilight',
			limitedToSetting: 'battleType==="Space"||"[side]"==="defender"'
		}),

		divinity: new Option('Divinity', "Save a unit that would be destroyed", {
			
			limitedToMode:'twilight'
			
		}),

		feint: new Option('Feint', "When you announce a retreat, immediately retreat", {
			limitedToBattle: root.BattleType.Space,
			limitedToMode:'twilight',
		}),

		lash: new Option('Lash', "When your unit is destroyed, destroy an opposing unit of equal or lesser cost", {
			limitedToBattle: root.BattleType.Space,
			limitedToMode:'twilight',
		}),
		
		meld: new Option('Meld', "Before your first roll, roll two dice and use their sum as the value of one die", {
			limitedToMode:'twilight'
		}),

		trine: new Option('Trine', "All of your units can shoot Space Cannon from a distance, during Space Cannon Offsense", {
			limitedToBattle: root.BattleType.Space,
			limitedToMode:'twilight'
		}),
	};


	root.Agendas = {
		articlesOfWar: new Option('Articles of War', 'All mechs lose their printed abilities except for SUSTAIN DAMAGE', {
			// limitedToMode:'standard',
		}),
		publicize: new Option('Publicize Weapon Schematics', 'War Suns lose Sustain Damage', {
			limitedToMode:'standard',
		}),
		prophecyOfIxth: new Option('Prophecy of Ixth', 'Apply +1 to your fighter\'s combat rolls', {
			limitedToMode:'standard',
		}),
		conventions: new Option('Conventions of War', 'Opponent cannot use Bombardment against your units on this cultural planet', {
			limitedToBattle: root.BattleType.Ground,
			limitedToMode:'standard',
		}),
		
	};

	root.Agents = {
		nomadAgent: new Option('Nomad Agent', "Redo combat rolls if you did worse and the opponent did better than expected", {inputType:'number', max:2}),

		yinAgent: new Option('Yin Agent', "After your unit is destroyed, make 2 fighters or 2 infantry if its is space/ground combat", {inputType:'number', max:2}),
	}

	root.Battlefield = {
		
		entropicScar: new Option('In an Entropic Scar', 'Units cannot use their unit abilities, or be affected by unit abilities'),

		nebula: new Option('In a Nebula', 'Defender\'s ships receive +1 to combat rolls during space combat', {limitedToSide: 'defender', limitedToBattle: root.BattleType.Space}),
		
		retreat: new Option('Announce a Retreat', 'Announce a retreat on the first round you can', {limitedToBattle:root.BattleType.Space}),

		

		empyreanFlagshipSupport: new Option('Empyrean Flagship Support', 'Empyrean\'s flagship repairs your units after they use Sustain Damage', {
			limitedToMode:'standard',
		}),

		crimsonFlagshipWeaken: new Option('Crimson Flagship Weaken', 'Crimson\'s flagship prevents you from using unit abilities',  {
			limitedToMode:'standard',
		}),

		smotheringPresenceWeaken: new Option('Smothering Presence Weaken', 'Smothering Presence prevents you from using unit abilities',  {
			limitedToMode:'twilight',
		}),

		notRetreat: new Option('Can\'t Retreat', 'You can\'t retreat into an adjacent system', {limitedToBattle:root.BattleType.Space, limitedToSetting:'options.[side].retreat||options.[side].ralnelCommander||options.[side].useForesight||options[otherSide].rout||options.[side].skilledRetreat'}),
	};

	root.Commanders = {
		argentCommander: new Option('Argent Commander', 'One unit rolls an additional die for unit ability rolls'),
		baronyCommander: new Option('Barony Commander', 'Gain 1 trade good when one of your units uses Sustain Damage'),
		ralnelCommander: new Option('Ral Nel Commander', 'Announce a retreat and immediately retreat your best two units'),	
		jolnarCommander: new Option('Jol-Nar Commander', 'Reroll your unit ability rolls'),
		
	};

	root.Heroes = {
		
		mentakHero: new Option('Mentak Hero', 'For every opponent ship destroyed, gain a ship of the same type'),
		
		
	};

	root.Promissory = {
		warFunding: new Option('War Funding', "Reroll combat dice during first space combat round", {
			inputType:'number', 
			max:2, 
			limitedToSetting:"options.[side].faction!=='Barony'",
			limitedToBattle: root.BattleType.Space,
		}),
		ambuscade: new Option('Strike Wing Ambuscade', " When 1 or more of your units make a roll for a unit ability: Choose 1 of those units to roll 1 additional die", {inputType:'number', max:2, limitedToSetting:"options.[side].faction!=='Argent'"}),
	}

	root.Relics = {
		voidShielding: new Option('Metali Void Shielding', "When assigning hits, cancel 1 hit as if one of your non-fighter ships had Sustain Damage"),
		crownOfThalnos: new Option('Crown of Thalnos Safely', "Reroll combat roll misses only if that unit already rolled a hit"),
		crownOfThalnosN: new Option('Crown of Thalnos (Custom)', "After rolling a 10 for combat and unit abilties, produce an additional hit"),
		lightrail: new Option('Lightrail Ordnance', "Your space docks gain Space Cannon 5(x2). You may use your space dock's SPACE CANNON against ships that are adjacent to their system"),
		voidArmaments: new Option('Metali Void Armaments', "During the \"Anti-Fighter Barrage\" step, you may resolve Anti-Fighter Barrage 6(x3) against your opponent's units", {
			limitedToBattle:  root.BattleType.Space,
		}),
		

	}

	root.Technologies = {

		
		
		// gravitonLaser: new Option('Graviton Laser System', 'Space Cannon hits should be applied to non-fighters if possible', {limitedToFaction: 'Arborec'}),

	
		
		plasmaScoring: new Option('Plasma Scoring', 'One additional die for one unit during Space Cannon or Bombardment'),

		plasmaScoringN: new Option('Plasma Scoring (Custom)', 'After using a Unit Ability (Space Cannon, Bombardment, or Barrage), set one die to a 7'),

		// assaultCannon: new Option('Assault Cannon', 'Opponent destroys 1 non-Fighter ship if you have at least 3 non-Fighters', {limitedToSetting:'units.[side].Infantry.upgraded'}),

		// assaultCannon2: new Option('Assault Cannon2', 'Opponent destroys 1 non-Fighter ship if you have at least 3 non-Fighters', {limitedToSetting:'units.defender.Infantry.upgraded', limitedToSide: 'defender'}),

		// antimassDeflectors: new Option('Antimass Deflectors', '-1 to opponents\' Space Cannon rolls', {limitedToSetting:'units.defender.Infantry.upgraded', limitedToSide: 'attacker'}),

		nonEuclidean: new Option('Non-Euclidean Shielding', 'Sustain Damage absorbs 2 hits'),

		dimensionalSplicer: new Option('Dimensional Splicer', 'Produce 1 hit and you assign it at the start of space combat', {
			limitedToBattle: root.BattleType.Space,
		}),

		selfAssembly: new Option('Self Assembly Routines', 'After 1 of your mechs is destroyed, gain 1 trade good'),

		
		
		duraniumArmor: new Option('Duranium Armor', 'After each round repair 1 unit that wasn\'t damaged this round'),

		assaultCannon: new Option('Assault Cannon', 'At the start of a space combat, destroy 1 opponent non-fighter ship if you have 3 of them'),

		proximaTargeting: new Option('Proxima Targeting VI', 'Cancel 1 Bombardment hit for each of your galvazined units. At the start of ground combat, roll 8(x3) Bombardment against both sides', {limitedToFaction: root.Faction.Bastion, limitedToBattle: root.BattleType.Ground}),

		noProximaRoll: new Option('No Proxima Roll', 'Don\'t resolve Bombardment rolls with Proxima Targeting VI', {limitedToSetting: 'options.[side].proximaTargeting||options.[side].copy.proximaTargetingCopy'}),


		valkyrie: new Option('Valkyrie Particle Weave', 'During ground combat, if your opponent produced a hit, you produce an additional hit', {limitedToFaction: root.Faction.Sardakk, limitedToBattle: root.BattleType.Ground}),

		
		
	};

	


	

	
	

	
	
	

	

	

	

	


	root.UniqueUnitsOptions = {
		sardakkFlagship: new Option("C'Morran N'orr (Sardakk Flagship)", "Flagship [8-6(x2)-1-3] {Sustain Damage} Apply +1 to the result of each of your other ship's combat rolls in this system"),
		sardakkDreadnought: new Option('Exotrireme I (Sardakk Dreadnought)', 'Dreadnought [4-5-1-1] {Sustain Damage} {Bombardment 4(x2)}'),
		sardakkMech: new Option('Valkyrie Exoskeleton (Sardakk Mech)', "Mech [2-6-*-*] {Sustain Damage} After this unit uses its SUSTAIN DAMAGE ability during Ground Combat, it produces 1 hit against your opponent's ground forces on this planet"),

		jolnarFlagship: new Option("J.N.S. Hylarim (Jolnar Flagship)", "Flagship [8-6(x2)-1-3] {Sustain Damage} When making a combat roll for this ship, each result of 9 or 10, before applying modifiers, produces 2 additional hits"),
		jolnarMech: new Option("Shield Paling  (Jolnar Mech)", "Mech [2-6-*-*] {Sustain Damage} Your infantry on this planet are not affected by your FRAGILE faction ability"),

		mentakFlagship: new Option("Fourth Moon (Mentak Flagship)", "Flagship [8-7(x2)-1-3] {Sustain Damage} Other players' ships in this system cannot use Sustain Damage"),
		mentakMech: new Option('Moll Terminus (Mentak Mech)', "Mech [2-6-*-*] {Sustain Damage} Other players' ground forces on this planet cannot use SUSTAIN DAMAGE"),

		nekroFlagship: new Option("The Alastor (Nekro Flagship)", "Flagship [8-9(x2)-1-3] {Sustain Damage} At the start of a space combat, choose any number of your ground forces in this system to participate in that combat as if they were ships"),
		nekroMech: new Option('Mordred (Nekro Mech)', 'Mech [2-6-*-*] {Sustain Damage} During combat against an opponent who has an "X" or "Y" token on 1 or more of their technologies, apply +2 to the result of each of this unit\'s combat rolls'),

		ralnelFlagship: new Option("Last Dispatch (Ral Nel Flagship)", "Flagship [8-8(x2)-2-4] {Sustain Damage} When this unit retreats, you may destroy 1 ship in the active system that does not have SUSTAIN DAMAGE"),
		ralnelMech: new Option('Alarum (Ral Nel Mech)', 'Mech [2-6-*-*] {Sustain Damage} At the end of a round of combat on this planet, you may move up to 2 of your ground forces to this planet from planets in adjacent systems'),
		ralnelDestroyer: new Option('Linkship I (Ral Nel Destroyer)', 'Destroyer [1-9-3-*] {Anti-Fighter Barrage 9(x2)} This unit can use the SPACE CANNON ability of one of your structures in its space area; each linkship can trigger the same structure'),

		argentDestroyer: new Option('Strike Wing Alpha I (Argent Destroyer)', 'Destroyer [1-8-2-1] {Anti-Fighter Barrage 9(x2)}'),
		argentFlagship: new Option('Quetzecoatl (Argent Flagship)', 'Flagship [8-7(x2)-1-3] {Sustain Damage} Other players cannot use space cannon against your ships in this system'),

		nomadFlagship: new Option('Memoria (Nomad Flagship)', 'Flagship [8-7(x2)-1-3] {Sustain Damage} {Anti-Fighter Barrage 8(x3)}'),
		nomadMech: new Option('Quantum Manipulator (Nomad Mech)', 'Mech [2-6-*-*] {Sustain Damage} While this unit is in a space area during combat, you may use its SUSTAIN DAMAGE ability to cancel a hit that is produced against your ships in this system'),

		naazRokhaMech: new Option('Eidolon (Naaz Rokha Mech)', 'Mech [2-6(x2)-*-*] {Sustain Damage} This unit transforms into the Z-Grav Eidolon at the start of a space combat'),

		xxchaMech: new Option('Indomitus (Xxcha Mech)', ' Mech [2-6-*-*] {Sustain Damage} {Space Cannon 8} You may use this unit\'s Space Cannon ability against ships that are in adjacent systems'),

		empyreanFlagship: new Option('Dynamo (Empyrean Flagship)', 'Flagship [8-5(x2)-1-3] {Sustain Damage} After any player\'s unit in this system or an adjacent system uses SUSTAIN DAMAGE, you may spend 2 influence to repair that unit'),

		crimsonFlagship: new Option('Quietus (Crimson Flagship)', 'Flagship [8-5(x2)-1-3] {Sustain Damage} While this unit is in a system that contains an active breach, other players units in systems with active breaches lose all their unit abilities'),

		l1z1xFlagship: new Option('[0.0.1] (L1Z1X Flagship)', 'Flagship [8-5(x2)-1-5] {Sustain Damage} During a space combat, hits produced by this ship and by your dreadnoughts in this system must be assigned to non-fighter ships if able'),

		titansPDS: new Option('Hel-Titan I (Titans PDS)', 'PDS [*-7-*-*] {Sustain Damage} {Planetary Shield} {Space Cannon 6} This unit is treated as both a structure and a ground force. It cannot be transported'),


		redFlagship: new Option('The Scarlet Knife (Red Flagship)', 'Flagship [8-5(x2)-2-3] {Sustain Damage}'),

		orangeFlagship: new Option('Airo Shir Rex (Orange Flagship)', 'Flagship [8-7(x2)-1-6] {Sustain Damage} {Anti-Fighter Barrage 5(x3)}'),
		orangeMech: new Option('Starlancer II (Orange Mech)', 'Mech [2-6-*-*] {Sustain Damage} {Planetary Shield} At the start of each round of ground combat, you may spend 1 token from your strategy pool to repair all of your mechs'),

		yellowFlagship: new Option('Scintillia (Yellow Flagship)', 'Flagship [8-9(x2)-1-1] {Sustain Damage}'),

		greenFlagship: new Option('Nightbloom (Green Flagship)', 'Flagship [8-7(x2)-1-6] {Sustain Damage}'),

		blueFlagship: new Option('Tizona (Blue Flagship)', 'Flagship [8-3-2-4] {Sustain Damage}'),
		blueMech: new Option('Colada (Blue Mech)', 'Mech [2-6-*-*] {Sustain Damage} While this unit is being transported, choose 1 unit in its system that has a capacity value to roll 1 additional die on its combat rolls'),

		purpleFlagship: new Option('Enigma (Purple Flagship)', 'Flagship [7-7-7-7] {Sustain Damage}'),
		purpleMech: new Option('Starlancer XI (Purple Mech)', 'Mech [2-6-*-*] {Sustain Damage} This unit participates in space combat as if it were a ship. For each anomaly this unit is in or adjacent to, apply +1 to this unit\'s combat rolls'),


		pinkFlagship: new Option('The Face of Janovet (Pink Flagship)', 'Flagship [8-5(x2)-1-3] {Sustain Damage} This unit gains the unit abilities and text abilities of your destroyer, cruiser, and dreadnought unit upgrade technologies'),

		blackFlagship: new Option('A Strangled Whisper (Black Flagship)', 'Flagship [8-7(x2)-1-1] {Sustain Damage} {Bombardment 7}'),
		blackMech: new Option('Bone Picked Clean XI (Purple Mech)', 'Mech [2-5(x2)-*-*] {Sustain Damage}'),

		basicWarSun: new Option('Basic War Sun', 'War Sun [12-5(x2)-0-6] {Sustain Damage} {Bombardment 5(x3)}'),
		
		

	}
	for (const [key, value] of Object.entries(root.UniqueUnitsOptions)) {
    	value.under = 'units'
	}
	root.UniqueUnitUpgradesOptions = {

		// Argent
		argentDestroyerII: new Option('Strike Wing Alpha II (Argent Destroyer)', 'Destroyer [1-7-2-1] {Anti-Fighter Barrage 6(x3)} When this unit uses ANTI-FIGHTER BARRAGE, each result of 9 or 10 also destroys 1 of your opponent\'s infantry in the space area of the active system', {limitedToSetting:"units.[side].Destroyer.upgraded"}),
		
		
		// Barony
		baronyDreadnought: new Option('Dawncrusher (Barony Dreadnought)', 'Dreadnought [3-5-2-1] {Sustain Damage} {Bombardment 4} This unit cannot be destroyed by "Spark" action cards', {
			limitedToSetting:"units.[side].Dreadnought.upgraded",
		}),

		// Crimson
		crimsonDestroyerTF: new Option('Exile (Crimson Destroyer)', 'Destroyer [1-8-4-*] {Anti-Fighter Barrage 6(x3)}', {limitedToSetting:"units.[side].Destroyer.upgraded"}),

		// Firmament
		firmamentWarSun: new Option('The Dragon, Freed (Firmament War Sun)', 'War Sun [12-3(x3)-2-6] {Sustain Damage} {Bombardment 3(x3)} When this unit uses Bombardment, it uses it against each planet in its sytem and each adjacent system, even yours, ignoring Planetary Shield', {
			limitedToSetting:"units.[side].WarSun.upgraded",
		}),

		// Jol-Nar
		jolnarWarSun: new Option('University War Sun (Jol-Nar War Sun)', 'War Sun [10-4(x3)-3-6] {Sustain Damage} {Bombardment 4(x3)} Other players\' units in this system lose Planetary Shield', {
			limitedToSetting:"units.[side].WarSun.upgraded",
		}),

		// Keleres
		keleresCruiser: new Option('Saggitaria (Keleres Cruiser)', 'Cruiser [2-6-3-1] {Sustain Damage}', {
			limitedToSetting:"units.[side].Cruiser.upgraded",
		}),

		// L1Z1X
		l1z1xDreadnoughtTF: new Option('Super-Dreadnought (L1Z1X Dreadnought)', 'Dreadnought [4-5-2-2] {Sustain Damage} {Bombardment 4} This unit cannot be destroyed by "Spark" action cards', {
			limitedToSetting:"units.[side].Dreadnought.upgraded",
		}),

		// Mentak
		mentakCruiserIII: new Option('Corsair (Mentak Cruiser Breakthrough)', 'Cruiser [2-6-3-2]', {limitedToSetting:"units.[side].Cruiser.upgraded"}),

		// Muatt
		muaatWarSunTF: new Option('Prototype War Sun (Muaat War Sun)', 'War Sun [12-3(x3)-2-6] {Sustain Damage} {Bombardment 3(x3)} Other players\' units in this system lose Planetary Shield', {
			limitedToSetting:"units.[side].WarSun.upgraded",
		}),

		// Naalu
		naaluFighterII: new Option('Hybrid Crystal Fighter II (Naalu Fighter)', 'Fighter [1(x2)-7-2-*] Each fighter in excess of your ships\' capacity counts as 1/2 of a ship against your fleet pool', {
			limitedToSetting:"units.[side].Fighter.upgraded",
		}),

		// Naaz-Rokha
		naazRokhaFighter: new Option('Morphwing (Naaz-Rokha Fighter)', 'Fighter [1(x2)-7-2-*] Each fighter in excess of your ships\' capacity counts against your fleet pool. This unit can be commited during an invasion, either return it to the space area or replace it with 1 infantry at the end of combat', {
			limitedToSetting:"units.[side].Fighter.upgraded",
		}),

		// Nomad
		nomadFlagshipII: new Option('Memoria II (Nomad Flagship)', 'Flagship [8-5(x2)-2-6] {Sustain Damage} {Anti-Fighter Barrage 5(x3)}', {limitedToSetting:"units.[side].Flagship.upgraded"}),

		// Ral Nel
		ralnelDestroyerII: new Option('Linkship II (Ral Nel Destroyer)', 'Destroyer [1-8-4-*] {Anti-Fighter Barrage 6(x3)} This unit can use the SPACE CANNON ability of one of your structures in its space area; each linkship can trigger the same structure', {limitedToSetting:"units.[side].Destroyer.upgraded"}),
		ralnelDestroyerTF: new Option('Linkship (Ral Nel Destroyer)', 'Destroyer [1-8-2-*] {Anti-Fighter Barrage 6(x3)} When this unit retreats, you may destroy 1 ship in the active system that is damaged or does not have Sustain Damage', {limitedToSetting:"units.[side].Destroyer.upgraded"}),

		// Sardakk
		sardakkDreadnoughtII: new Option('Exotrireme II (Sardakk Dreadnought)', 'Dreadnought [4-5-2-1] {Sustain Damage} {Bombardment 4(x2)} This unit cannot be destroyed by "Direct Hit" action cards; After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system', {
			limitedToSetting:"units.[side].Dreadnought.upgraded",
		}),

		sardakkDreadnoughtTF: new Option('Exotrireme II (Sardakk Dreadnought)', 'Dreadnought [4-4-2-1] {Sustain Damage} {Bombardment 4(x2)} This unit cannot be destroyed by "Spark" action cards; After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system', {
			limitedToSetting:"units.[side].Dreadnought.upgraded",
		}),

		// Sol
		solCarrierII: new Option('Advanced Carrier II (Sol Dreadnought)', 'Carrier [3-9-2-8] {Sustain Damage}', {
			limitedToSetting:"units.[side].Carrier.upgraded",
		}),

		// Titans
		titansPDSII: new Option('Hel-Titan II (Titans PDS)', 'PDS [*-6-*-*] {Sustain Damage} {Planetary Shield} {Space Cannon 5} This unit is treated as both a structure and a ground force. It cannot be transported. You may use this unit\'s SPACE CANNON against ships that are adjacent to this unit\'s system', {
			limitedToSetting:"units.[side].PDS.upgraded"
		}),
		titansPDSTF: new Option('Hel-Titan II (Titans PDS)', 'PDS [*-5-*-*] {Sustain Damage} {Planetary Shield} {Space Cannon 5} This unit is treated as both a structure and a ground force. It cannot be transported. You may use this unit\'s SPACE CANNON against ships that are adjacent to this unit\'s system', {
			limitedToSetting:"units.[side].PDS.upgraded"
		}),

		// Winnu
		winnuPDS: new Option('Justicier Rail (Winnu PDS)', 'PDS [*-*-*-*] {Planetary Shield} {Space Cannon 5} You may use this unit\'s Space Cannon ability against ships that are adjacent to this unit\'s system. Hits produced by this unit must be assigned to non-fighter ships if able', {
			limitedToSetting:"units.[side].PDS.upgraded"
		}),

		// Xxcha
		xxchaPDS: new Option('Keeper Matrix (Xxcha PDS)', 'PDS [*-*-*-*] {Planetary Shield} {Space Cannon 5(x2)} You may use this unit\'s Space Cannon ability against ships that are adjacent to this unit\'s system', {
			limitedToSetting:"units.[side].PDS.upgraded"
		}),

		
		// l1z1xDreadnoughtII: new Option('Exotrireme II (L1Z1X Dreadnought)', 'Dreadnought [4-5-2-1] {Sustain Damage} {Bombardment 4(x2)} This unit cannot be destroyed by "Direct Hit" action cards; After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system', {limitedToSetting:"units.[side].Dreadnought.upgraded"}),

		
		

		basicDreadnoughtII: new Option('Basic Dreadnought', 'Dreadnought [4-5-2-1] {Sustain Damage} {Bombardment 5}', {limitedToSetting:"units.[side].Dreadnought.upgraded"}),
	}

	

	for (const [key, value] of Object.entries(root.UniqueUnitUpgradesOptions)) {
    	value.under = 'units'
	}

	
	root.UniqueUnitBuffs = {
		naazRokhaMechII: new Option('Eidolon Maximum (Naaz Rokha Breakthrough)', 'Mech [2-4(x4)-3-*] {Sustain Damage} This unit is both a ship and a ground force. It cannot be assigned hits from unit abilities. Repair it and the start of every combat round'),

		nomadFlagshipBuff: new Option('Echo of Ascension (Nomad Flagship)', 'Flagship [*-{-1}(+1)-{+1}-{+2}]', {limitedToSetting:"units.[side].Flagship.upgraded", limitedToMode:'twilight'}),

		naazRokhaMechBuff: new Option('Eidolon Landwaster (Naaz-Rokha Mech)', 'Mech [*-(+1)-*-*]', {limitedToSetting:"units.[side].Mech.upgraded", limitedToMode:'twilight'}),
		cabalMechBuff: new Option('Eidolon Terminus (Cabal Mech)', 'Mech [*-{-1}-*-*]', {limitedToSetting:"units.[side].Mech.upgraded", limitedToMode:'twilight'}),
		nekroMechBuff: new Option('Valefar Prime (Nekro Mech)', 'Mech [{-1}-*-*-*]', {limitedToSetting:"units.[side].Mech.upgraded", limitedToMode:'twilight'}),
	}
	
	for (const [key, value] of Object.entries(root.UniqueUnitBuffs)) {
    	value.under = 'units'
	}
	
	root.FlagshipAbility = {
		mentakFlagshipAbility: new Option('Mentak Flagship Ability', 'Other players\' ships in this system cannot use Sustain Damage'),
		crimsonFlagshipAbility: new Option('Crimson Flagship Ability', 'While this unit is in a system that contains an active breach, other players units in systems with active breaches lose all their unit abilities'),
	}
	for (const [key, value] of Object.entries(root.FlagshipAbility)) {
    	value.under = 'units';
	}




	root.FactionSpecific = {
		
		
		useForesight: new Option('Use Foresight', 'Use your Foresight Ability', {limitedToSetting: 'options.[side].abilities.foresight'}),

		activeBreach: new Option('Active Breach', 'Active breach in the active system', {
			limitedToUnitAbility:'crimsonFlagship', 
			limitedToSetting:'options.[side].copy.crimsonFlagshipAbilityCopy||options.[side].units.crimsonFlagshipAbility', 
			orMode: true
		}),

		nearbyAnomalies: new Option('Nearby Anomalies', '# of Anomalies in or adjacent to the active system', {
			inputType: 'number',
			limitedToSetting: 'options.[side].units.purpleMech',
			max: 6,
		}),

		orangeMechRepairsOne: new Option('Mech Repairs One', 'Repair your mechs when one of them is damaged', {
			limitedToSetting: 'options.[side].units.orangeMech',
			limitedToBattle: root.BattleType.Ground,
			exclusive: ['orangeMechRepairsHalf', 'orangeMechRepairsAll']
		}),
		orangeMechRepairsHalf: new Option('Mech Repairs Half', 'Repair your mechs when half (rounded up) of them are damaged', {
			limitedToSetting: 'options.[side].units.orangeMech',
			limitedToBattle: root.BattleType.Ground,
			exclusive: ['orangeMechRepairsOne', 'orangeMechRepairsAll']
		}),
		orangeMechRepairsAll: new Option('Mech Repairs All', 'Repair your mechs when all of them are damaged', {
			limitedToSetting: 'options.[side].units.orangeMech',
			limitedToBattle: root.BattleType.Ground,
			exclusive: ['orangeMechRepairsHalf', 'orangeMechRepairsOne']
		}),

		munitionsReservesOnceRound: new Option('Use Munitions Reserves Once', 'Use Munitions Reserves on the first round of space combat you can', {
			
			limitedToSetting: 'options.[side].abilities.munitionsReserves||options.[side].copy.munitionsReservesCopy',
			exclusive: ['munitionsReservesEveryRound']
		}),
		munitionsReservesEveryRound: new Option('Use Munitions Reserves Every Round', 'Use Munitions Reserves on every round of space combat', {
			
			limitedToSetting: 'options.[side].abilities.munitionsReserves||options.[side].copy.munitionsReservesCopy',
			exclusive: ['munitionsReservesFirstRound']
		}),

		
		
	}

	

	root.SingularityCopy = {
			plasmaScoringCopy: new Option('Copy Plasma Scoring', 'Copy Plasma Scoring during combat after destroying an opponent\'s unit', {limitedToSetting:"options.[otherSide].plasmaScoring"}),

			duraniumArmorCopy: new Option('Copy Duranium Armor', 'Copy Duranium Armor during combat after destroying an opponent\'s unit', {limitedToSetting:"options.[otherSide].duraniumArmor"}),

			nonEuclideanCopy: new Option('Copy Non-Euclidean Shielding', 'Copy Non-Euclidean Shielding during combat after destroying an opponent\'s unit', {limitedToSetting:"options.[otherSide].nonEuclidean"}),

			valkyrieCopy: new Option('Copy Valkyrie Particle Weave', 'Copy Valkyrie Particle Weave during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].valkyrie&&!options.[side].valkyrie",
			}),

			infantryIICopy: new Option('Copy Infantry II', 'Copy Infantry II during combat after destroying an opponent\'s unit', {limitedToSetting:"units.[otherSide].Infantry.upgraded"}),

			dreadnoughtIICopy: new Option('Copy Dreadnought II', 'Copy Dreadnought II during combat after destroying an opponent\'s unit', {limitedToSetting:"units.[otherSide].Dreadnought.upgraded&&!units.[side].Dreadnought.upgraded&&!options.[otherSide].units.sardakkDreadnoughtII"}),



			sardakkDreadnoughtIICopy: new Option('Copy Exotrireme II', 'Copy Exotrireme II during combat after destroying an opponent\'s unit', {limitedToSetting:"units.[otherSide].Dreadnought.upgraded&&options.[otherSide].units.sardakkDreadnoughtII&&!options.[side].units.sardakkDreadnoughtII"}),

			titansPDSIICopy: new Option('Copy Hel-Titan II', 'Copy Hel-Titan II during combat after destroying an opponent\'s unit', {limitedToSetting:"units.[otherSide].PDS.upgraded&&options.[otherSide].units.titansPDSII&&!options.[side].units.titansPDSII"}),

			mentakFlagshipAbilityCopy: new Option('Copy Mentak Flagship Ability', 'Copy Mentak Flagship Ability during combat after destroying an opponent\'s unit', {limitedToSetting:"options.[otherSide].units.mentakFlagship&&!options.[side].units.mentakFlagshipAbility"}),

			crimsonFlagshipAbilityCopy: new Option('Copy Crimson Flagship Ability', 'Copy Crimson Flagship Ability during combat after destroying an opponent\'s unit', {limitedToSetting:"options.[otherSide].units.crimsonFlagship&&!options.[side].units.crimsonFlagshipAbility"}),

			harrowCopy: new Option('Copy Harrow', 'Copy Harrow ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].abilities.harrow&&!options.[side].abilities.harrow",
				limitedToMode: 'twilight',
			}),

			indoctrinationCopy: new Option('Copy Indoctrination', 'Copy Indoctrination ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].abilities.indoctrination&&!options.[side].abilities.indoctrination",
				limitedToMode: 'twilight',
			}),

			munitionsReservesCopy: new Option('Copy Munitions Reserves', 'Copy Munitions Reserves ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].abilities.munitionsReserves&&!options.[side].abilities.munitionsReserves",
				limitedToMode: 'twilight',
			}),

			planesplitterCopy: new Option('Copy Planesplitter', 'Copy Planesplitter ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].abilities.planesplitter&&!options.[side].abilities.planesplitter",
				limitedToMode: 'twilight',
			}),

			proximaTargetingTFCopy: new Option('Copy Proxima Targeting VI', 'Copy Proxima Targeting VI ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].abilities.proximaTargetingTF&&!options.[side].abilities.proximaTargetingTF",
				limitedToMode: 'twilight',
			}),

			raidFormationCopy: new Option('Copy Raid Formation', 'Copy Raid Formation ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].abilities.raidFormation&&!options.[side].abilities.raidFormation",
				limitedToMode: 'twilight',
			}),

			smotheringPresenceCopy: new Option('Copy Smothering Presence', 'Copy Smothering Presence ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].abilities.smotheringPresence&&!options.[side].abilities.smotheringPresence",
				limitedToMode: 'twilight',
			}),
			superchargeTFCopy: new Option('Copy Supercharge', 'Copy Supercharge ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].abilities.superchargeTF&&!options.[side].abilities.superchargeTF",
				limitedToMode: 'twilight',
			}),
			jolnarCommanderCopy: new Option('Copy Tactical Brilliance', 'Copy Tactical Brilliance ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].jolnarCommander&&!options.[side].jolnarCommander",
				limitedToMode: 'twilight',
			}),
			argentCommanderCopy: new Option('Copy Zealous', 'Copy Zealous ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].argentCommander&&!options.[side].argentCommander",
				limitedToMode: 'twilight',
			}),

			unrelentingCopy: new Option('Copy Unrelenting', 'Copy Unrelenting ability during combat after destroying an opponent\'s unit', {
				limitedToSetting:"options.[otherSide].abilities.unrelenting&&!options.[side].abilities.unrelenting",
				limitedToMode: 'twilight',
			}),

			

			
	}
	for (const [key, value] of Object.entries(root.SingularityCopy)) {
    	value.under = 'copy';
	}

	

	root.FactionSpecificOptions = [
		new OptionGroup(Object.fromEntries(
            Object.entries(root.UniqueUnitUpgradesOptions).filter(([k]) => k !== "mentakCruiserIII" && k !== "basicDreadnoughtII")
        ), 
		{limitedToSetting:'options.[side].abilities.singularity'}),

		new OptionGroup(root.FlagshipAbility, {limitedToSetting:'options.[side].abilities.singularity'}),
		new OptionGroup(root.SingularityCopy, {limitedToSetting:'options.[side].abilities.singularity'}),

		new OptionGroup({'mentakHero' : root.Heroes.mentakHero}, ),
		
		root.FactionSpecific,
		new OptionGroup({
			mentakCruiserIII: root.UniqueUnitUpgradesOptions.mentakCruiserIII
		}, {limitedToFaction:'Mentak'}),
		new OptionGroup({
			naazRokhaMechII: root.UniqueUnitBuffs.naazRokhaMechII
		}, {limitedToFaction:'NaazRokha'}),

		

		
	]

	root.AbilitiesTwilightsFall = [
		
		{
			ambush: root.Abilities.ambush,
			dimensionalSplicer: root.Technologies.dimensionalSplicer.update({limitedToFaction:undefined, title:'Dimensional Splicer (Creuss)'}),
			foresightTF: root.Abilities.foresightTF,
			harrow: root.Abilities.harrow,
			indoctrination: root.Abilities.indoctrination, 

			munitionsReserves: root.Abilities.munitionsReserves,
			munitionsReservesOnceRound: root.FactionSpecific.munitionsReservesOnceRound,
			munitionsReservesEveryRound: root.FactionSpecific.munitionsReservesEveryRound,

			nonEuclidean: root.Technologies.nonEuclidean.update({limitedToFaction:undefined, title:'Non-Euclidean Shielding (Barony)'}),
			planesplitter: root.Abilities.planesplitter,

			proximaTargetingTF: root.Abilities.proximaTargetingTF,
			noProximaRoll: root.Technologies.noProximaRoll.update({
				limitedToSetting: 'options.[side].abilities.proximaTargetingTF||options.[side].copy.proximaTargetingTFCopy'
			}),
			
			raidFormation: root.Abilities.raidFormation,

			singularityX: root.Abilities.singularityX,
			singularityY: root.Abilities.singularityY,
			singularityZ: root.Abilities.singularityZ,

			harrowCopy: root.SingularityCopy.harrowCopy.addSin(),
			indoctrinationCopy: root.SingularityCopy.indoctrinationCopy.addSin(),
			planesplitterCopy: root.SingularityCopy.planesplitterCopy.addSin(),
			proximaTargetingTFCopy: root.SingularityCopy.proximaTargetingTFCopy.addSin(),
			raidFormationCopy: root.SingularityCopy.raidFormationCopy.addSin(),

			smotheringPresenceCopy: root.SingularityCopy.smotheringPresenceCopy.addSin(),
			superchargeTFCopy: root.SingularityCopy.superchargeTFCopy.addSin(),
			jolnarCommanderCopy: root.SingularityCopy.jolnarCommanderCopy.addSin(),
			argentCommanderCopy: root.SingularityCopy.argentCommanderCopy.addSin(),
			

			munitionsReservesCopy: root.SingularityCopy.munitionsReservesCopy.addSin(),
			nonEuclideanCopy: root.SingularityCopy.nonEuclideanCopy.addSin(),
			unrelentingCopy: root.SingularityCopy.unrelentingCopy.addSin(),
			valkyrieCopy: root.SingularityCopy.valkyrieCopy.addSin(),



			smotheringPresence: root.Abilities.smotheringPresence,
			superchargeTF: root.Abilities.superchargeTF,
			jolnarCommander: root.Commanders.jolnarCommander.update({
				title: 'Tactical Brilliance (Jol-Nar)',
			}),
			unrelenting: root.Abilities.unrelenting,
			valkyrie: root.Technologies.valkyrie.update({
				limitedToFaction: undefined,
				title: "Valkyrie Particle Weave (Sardakk)"
			}),
			argentCommander: root.Commanders.argentCommander.update({
				title: 'Zealous (Argent)',
			}),


		},
	]

	root.UnitUpgradesTwilightsFall = [
		// root.UniqueUnitUpgradesOptions,
		{
			
			solCarrierII: root.UniqueUnitUpgradesOptions.solCarrierII.noII(),
			baronyDreadnought: root.UniqueUnitUpgradesOptions.baronyDreadnought,
			
			l1z1xDreadnoughtTF: root.UniqueUnitUpgradesOptions.l1z1xDreadnoughtTF,
			mentakCruiserIII: root.UniqueUnitUpgradesOptions.mentakCruiserIII.update({
				title: 'Corsair (Mentak Cruiser)',
			}),
			muaatWarSunTF: root.UniqueUnitUpgradesOptions.muaatWarSunTF,
			naaluFighterII: root.UniqueUnitUpgradesOptions.naaluFighterII.noII(),
			jolnarWarSun: root.UniqueUnitUpgradesOptions.jolnarWarSun,
			winnuPDS: root.UniqueUnitUpgradesOptions.winnuPDS,
			xxchaPDS: root.UniqueUnitUpgradesOptions.xxchaPDS,
			argentDestroyerII: root.UniqueUnitUpgradesOptions.argentDestroyerII.noII(),


			keleresCruiser: root.UniqueUnitUpgradesOptions.keleresCruiser,
			naazRokhaFighter: root.UniqueUnitUpgradesOptions.naazRokhaFighter,
			titansPDSTF: root.UniqueUnitUpgradesOptions.titansPDSTF,
			sardakkDreadnoughtTF: root.UniqueUnitUpgradesOptions.sardakkDreadnoughtTF,
			ralnelDestroyerTF: root.UniqueUnitUpgradesOptions.ralnelDestroyerTF,
			firmamentWarSun: root.UniqueUnitUpgradesOptions.firmamentWarSun,

			crimsonDestroyerTF: root.UniqueUnitUpgradesOptions.crimsonDestroyerTF,
			crimsonDestroyerTF: root.UniqueUnitUpgradesOptions.crimsonDestroyerTF,
			crimsonDestroyerTF: root.UniqueUnitUpgradesOptions.crimsonDestroyerTF,
			crimsonDestroyerTF: root.UniqueUnitUpgradesOptions.crimsonDestroyerTF,
			crimsonDestroyerTF: root.UniqueUnitUpgradesOptions.crimsonDestroyerTF,
			crimsonDestroyerTF: root.UniqueUnitUpgradesOptions.crimsonDestroyerTF,

			

		},
		
		// root.UniqueUnitBuffs,
		{
			nomadFlagshipBuff: root.UniqueUnitBuffs.nomadFlagshipBuff,
			naazRokhaMechBuff: root.UniqueUnitBuffs.naazRokhaMechBuff,
			cabalMechBuff: root.UniqueUnitBuffs.cabalMechBuff,
			nekroMechBuff: root.UniqueUnitBuffs.nekroMechBuff,

		}
	]

	
	root.Leaders = [
		root.Agents,
		root.Commanders,
	]

	root.Genomes = [
		root.Agents,
		root.Heroes,
	]


	root.OtherComponents = [
		root.Relics,
		root.Agendas
	]



	root.Everything = [
		root.MaxSpend,
		root.ActionCards,
		root.Technologies,
		root.Agents,
		root.Commanders,
		root.Heroes,
		root.Battlefield,
		root.FactionSpecific,
		root.SingularityCopy,
		root.FlagshipAbility,
		root.UniqueUnitsOptions,
		root.UniqueUnitUpgradesOptions,
		root.Abilities,
		// root.UniqueAbilities,
		root.Relics,
		root.Promissory,
		root.UniqueUnitBuffs,
	]




	root.startingOptions = {
		// Arborec: ['plasmaScoring'],
		// Hacan: ['antimassDeflectors'],
		
	};
	root.startingUnits = {
		Sardakk: ['sardakkFlagship', 'sardakkDreadnought', 'sardakkMech', 'sardakkDreadnoughtII'],
		Mentak: ['mentakFlagship', 'mentakMech'],
		Nekro: ['nekroFlagship', 'nekroMech'],
		JolNar: ['jolnarFlagship', 'jolnarMech'],
		RalNel: ['ralnelFlagship', 'ralnelMech', 'ralnelDestroyer', 'ralnelDestroyerII'],
		Argent: ['argentFlagship', 'argentDestroyer', 'argentDestroyerII'],
		Nomad: ['nomadFlagship', 'nomadFlagshipII', 'nomadMech'],
		NaazRokha: ['naazRokhaMech'],
		Xxcha: ['xxchaMech'],
		Empyrean: ['empyreanFlagship'],
		Crimson: ['crimsonFlagship'],
		L1Z1X: ['l1z1xFlagship'],
		Titans: ['titansPDS', 'titansPDSII'],


		Red: ['redFlagship', 'basicWarSun'],
		Orange: ['orangeFlagship', 'orangeMech', 'basicWarSun'],
		Yellow: ['yellowFlagship', 'basicWarSun'],
		Green: ['greenFlagship', 'basicWarSun'],
		Blue: ['blueFlagship', 'blueMech', 'basicWarSun'],
		Purple: ['purpleFlagship', 'purpleMech', 'basicWarSun'],
		Pink: ['pinkFlagship', 'basicWarSun'],
		Black: ['blackFlagship', 'blackMech', 'basicWarSun'],
		Neutral: ['basicDreadnoughtII']

		
	}
	root.startingAbilities = {
		Mentak: ['ambush'],
		L1Z1X: ['harrow'],
		RalNel: ['mini'],
		Naalu: ['foresight'],
		Nekro: ['singularity', 'propagation'],
		Argent: ['raidFormation'],
		
		// Nomad: ['']
		
	}
	

	function Resource(shortType, attackerOptions, defenderOptions) {
		// this.name = name;
		this.shortType = shortType;
		this.attackerOptions = attackerOptions;
		this.defenderOptions = defenderOptions;
	}



	Resource.prototype.calc = function (options) {
		
		var attackerTotal = 0;
		var defenderTotal = 0;
		for (const option of this.attackerOptions){
			attackerTotal += Object.byString(options,option);
		}
		for (const option of this.defenderOptions){
			defenderTotal += Object.byString(options,option);
		}
		return [attackerTotal, defenderTotal];
	};

	root.resources = {
		moraleBoost: new Resource('MB', ['attacker.moraleBoost'], ['defender.moraleBoost']),
		meld: new Resource('ML', ['attacker.meld'], ['defender.meld']),
		courageous: new Resource('CE', ['attacker.courageous'], ['defender.courageous']),
		intercept: new Resource('IC', ['attacker.intercept'], ['defender.intercept']),
		rout: new Resource('RT', [], ['defender.rout']),
		directHit: new Resource('DH', ['attacker.directHit'], ['defender.directHit']),
		nomadAgent: new Resource('NA', ['attacker.nomadAgent'], ['defender.nomadAgent']),
		warFunding: new Resource('WF', ['attacker.warFunding'], ['defender.warFunding']),
		ambuscade: new Resource('AB', ['attacker.ambuscade'], ['defender.ambuscade']),
		emergencyRepairs: new Resource('ER', ['attacker.emergencyRepairs'], ['defender.emergencyRepairs']),
		fireTeam: new Resource('FT', ['attacker.fireTeam'], ['defender.fireTeam']),
		maneuveringJets: new Resource('MJ', ['attacker.maneuveringJets'], ['defender.maneuveringJets']),
		shieldsHolding: new Resource('SH', ['attacker.shieldsHolding'], ['defender.shieldsHolding']),
		// scramble: new Resource('SF', ['attacker.scramble'], ['defender.scramble']),
		waylay: new Resource('WY', ['attacker.waylay'], ['defender.waylay']),
		yinAgent: new Resource('YA', ['attacker.yinAgent'], ['defender.yinAgent']),
		converge: new Resource('CV', ['attacker.converge'], ['defender.converge']),
		divinity: new Resource('DV', ['attacker.divinity'], ['defender.divinity']),
		hardlight: new Resource('HL', ['attacker.hardlight'], ['defender.hardlight']),
		lash: new Resource('LA', ['attacker.lash'], ['defender.lash']),
		spark: new Resource('SP', ['attacker.spark'], ['defender.spark']),
		
		

		tgs: new Resource('TG', ['attacker.maxSpend'], ['defender.maxSpend']),
	};
	
	
	root.UnitInfo = (function () {

		function UnitInfo(type, stats) {

			if (stats._baseStats !== undefined){
				this._baseStats = { ...stats._baseStats };
				if (stats._baseStats.abilities){
					this._baseStats.abilities = [...stats._baseStats.abilities];
				}
			} else {
				this._baseStats = { ...stats };
			}
			

			this.type = type;
			this.shortType = shortUnitType[this.type];
			// this.shortType = stats.isDamageGhost ? (shortType === "+" ? '-': shortType.toLowerCase()) : shortType;


			this.battleValue = stats.battleValue || undefined;
			this.battleDice = stats.battleDice !== undefined ? stats.battleDice : 1;

			this.bombardmentValue = stats.bombardmentValue || undefined;
			this.bombardmentDice = stats.bombardmentDice || 0;

			this.spaceCannonValue = stats.spaceCannonValue || undefined;
			this.spaceCannonDice = stats.spaceCannonDice || 0;

			this.barrageValue = stats.barrageValue || undefined;
			this.barrageDice = stats.barrageDice || 0;

			
			

			this.ghostCorporeal = undefined;
			this.damageCorporeal = undefined;
			
			this.damaged = stats.damaged || false;
			this.sustainedThisRound = stats.sustainedThisRound || false;
			this.alreadySustained = stats.alreadySustained || false;
			this.label = stats.label || undefined;
			this.sustainDamage = stats.sustainDamage || false;
			this.isDamageGhost = stats.isDamageGhost || false;

			this.faction = stats.faction;
			this.cost = stats.cost;
			

			var list = [
				UnitType.Flagship,
				UnitType.WarSun,
				UnitType.Dreadnought,
				UnitType.Cruiser,
				UnitType.Destroyer,
				UnitType.Carrier,
				UnitType.Fighter,
			];
			this.typeShip = stats.typeShip || list.includes(type);
			this.typeGroundForce = stats.typeGroundForce || type === root.UnitType.Mech || type === root.UnitType.Infantry;
			this.typeStructure = stats.typeStructure || (type === root.UnitType.PDS || type === root.UnitType.SpaceDock) ;

			this.planetaryShield = stats.planetaryShield || type === root.UnitType.PDS;
			this.importance = stats.importance || 0;
			
			this.dead = stats.dead || false;
			this.leaveEarly = stats.leaveEarly || false;

			this.galvanized = stats.galvanized || false;


			this.notParticipatingWhilePresent = stats.notParticipatingWhilePresent || false;
			this.notActiveSystem = stats.notActiveSystem || false;
			this.activeSystemAdjacentPlanet = stats.activeSystemAdjacentPlanet || false;
			this.spaceArea = stats.spaceArea;
			this.planet = stats.planet;
			
			


			this.retreatEarly = stats.retreatEarly || false;
			this.notInitBombardment = stats.notInitBombardment || false;
			

			if (stats.abilities !== undefined ){
				this.abilities = [...stats.abilities];
			} else {
				this.abilities = [];
			}
			
			this.flagPointers = [];

			
			this.move = stats.move;
			this.capacity = stats.capacity;
			
			

			
			
			this.lostBarrage = stats.lostBarrage || false;
			this.lostBombardment = stats.lostBombardment || false;
			this.lostDeploy = stats.lostDeploy || false;
			this.lostPlanetaryShield = stats.lostPlanetaryShield || false;
			this.lostSpaceCannon = stats.lostSpaceCannon || false;
			this.lostSustain = stats.lostSustain || false;

			this.notUseBarrage = stats.notUseBarrage || false;
			this.notUseBombardment = stats.notUseBombardment || false;
			this.notUseDeploy = stats.notUseDeploy || false;
			this.notUsePlanetaryShield = stats.notUsePlanetaryShield || false;
			this.notUseSpaceCannon = stats.notUseSpaceCannon || false;
			this.notUseSustain = stats.notUseSustain || false;

			this.notUseUnitAbilities = stats.notUseUnitAbilities || false;
			this.lostUnitAbilities = stats.lostUnitAbilities || false;

			

			if (this.notUseUnitAbilities){
				this.notUseBarrage = true;
				this.notUseBombardment = true;
				this.notUseDeploy = true;
				this.notUsePlanetaryShield = true;
				this.notUseSpaceCannon = true;
				this.notUseSustain = true;
			}

			if (this.lostUnitAbilities){
				this.lostBarrage = true;
				this.lostBombardment = true;
				this.lostDeploy = true;
				this.lostPlanetaryShield = true;
				this.lostSpaceCannon = true;
				this.lostSustain = true;
			}



			
			this.passive = stats.passive || false;
			this.invisible = stats.invisible || false;
			this.immune = stats.immune || false;
			this.retreated = stats.immune || false;
			

			

			if (this.isDamageGhost) {
				this.shortType = this.shortType === "+" ? '-': this.shortType.toLowerCase();

				this.battleDice = 0;
				this.bombardmentDice = 0;
				this.spaceCannonDice = 0;
				this.barrageDice = 0;

				this.battleValue = NaN;
				this.bombardmentValue = NaN;
				this.spaceCannonValue = NaN;
				this.barrageValue = NaN;

				
				this.sustainDamage = 0;
				this.planetaryShield = false;
				// this.directHitImmune = false;
				this.damaged = false;
				this.sustainedThisRound = false;
				this.abilities=[];
				// this.ghostCorporeal = undefined;

				this.move = 0;
				

				this.notUseUnitAbilities = false
				this.notUseBarrage = false;
				this.notUseBombardment = false;
				this.notUseDeploy = false;
				this.notUsePlanetaryShield = false;
				this.notUseSpaceCannon = false;
				this.notUseSustain = false;

				this.lostUnitAbilities = false;
				this.lostBarrage = false;
				this.lostBombardment = false;
				this.lostDeploy = false;
				this.lostPlanetaryShield = false;
				this.lostSpaceCannon = false;
				this.lostSustain = false;
			}
			

			this.presentPlanet = (this.planet && (!this.activeSystemAdjacentPlanet && !this.notActiveSystem));
			this.presentSpace = (this.spaceArea && !this.notActiveSystem);
			

				
			
		}

		UnitInfo.prototype.clone = function (overrides) {
			const statsCopy = { ...this };
			if (overrides) {
				Object.assign(statsCopy, overrides);
			}
			const output = new UnitInfo(this.type, statsCopy);
			// output.abilities = [...output.abilities];
			

			return output;
		};

		UnitInfo.prototype.update = function (changes) {
			Object.assign(this, changes);
			this.label = undefined;

			if (changes.notUseUnitAbilities){
				this.notUseBarrage = true;
				this.notUseBombardment = true;
				this.notUseDeploy = true;
				this.notUsePlanetaryShield = true;
				this.notUseSpaceCannon = true;
				this.notUseSustain = true;
			}
			if (changes.notUseUnitAbilities === false){
				this.notUseBarrage = false;
				this.notUseBombardment = false;
				this.notUseDeploy = false;
				this.notUsePlanetaryShield = false;
				this.notUseSpaceCannon = false;
				this.notUseSustain = false;
			}

			if (changes.lostUnitAbilities){
				this.lostBarrage = true;
				this.lostBombardment = true;
				this.lostDeploy = true;
				this.lostPlanetaryShield = true;
				this.lostSpaceCannon = true;
				this.lostSustain = true;
			}

			if (changes.retreated){
				this.invisible = true;
				this.immune = true;
				this.passive = true;
				this.notActiveSystem = true;
				this.spaceArea = true;
				this.planet = false;
				this.adjacent = true;
				this.notActivePlanet = false;
			}

			if (this.isDamageGhost){
				this.battleDice = 0;
				this.bombardmentDice = 0;
				this.spaceCannonDice = 0;
				this.barrageDice = 0;

				this.battleValue = NaN;
				this.bombardmentValue = NaN;
				this.spaceCannonValue = NaN;
				this.barrageValue = NaN;

				
				this.sustainDamage = 0;
				this.planetaryShield = false;
				this.damaged = false;
				this.sustainedThisRound = false;
				this.abilities=[];

				this.move = 0;
				

				this.notUseUnitAbilities = false
				this.notUseBarrage = false;
				this.notUseBombardment = false;
				this.notUseDeploy = false;
				this.notUsePlanetaryShield = false;
				this.notUseSpaceCannon = false;
				this.notUseSustain = false;

				this.lostUnitAbilities = false;
				this.lostBarrage = false;
				this.lostBombardment = false;
				this.lostDeploy = false;
				this.lostPlanetaryShield = false;
				this.lostSpaceCannon = false;
				this.lostSustain = false;
			}
			if (changes.spaceArea !== undefined) this.planet = !changes.spaceArea;
			if (changes.planet !== undefined) this.spaceArea = !changes.planet;
			if (changes.spaceArea) this.activeSystemAdjacentPlanet = false;
			if (changes.notActiveSystem) this.activeSystemAdjacentPlanet = false;
			if (changes.activeSystemAdjacentPlanet) {
				this.notActiveSystem = false;
				this.planet = true;
				this.spaceArea = false;
			}

			

			this.presentPlanet = (this.planet && (!this.activeSystemAdjacentPlanet && !this.notActiveSystem));
			this.presentSpace = (this.spaceArea && !this.notActiveSystem);

			
		};

		
		UnitInfo.prototype.toDamageGhost = function () {
			
			var result = this.clone({isDamageGhost:true});
			
			result.update({damageCorporeal: this, })

			
			this.ghostCorporeal = result;

			return result;
		};
		return UnitInfo;
	})();

	// These correspond to fields of UnitInfo, like 'battleValue', 'bombardmentValue' etc. 
	root.ThrowType = {
		Battle: 'battle',
		Bombardment: 'bombardment',
		SpaceCannon: 'spaceCannon',
		Barrage: 'barrage',
	};
	root.ThrowValues = {
		battle: 'battleValue',
		bombardment: 'bombardmentValue',
		spaceCannon: 'spaceCannonValue',
		barrage: 'barrageValue',
	};
	root.ThrowDice = {
		battle: 'battleDice',
		bombardment: 'bombardmentDice',
		spaceCannon: 'spaceCannonDice',
		barrage: 'barrageDice',
	};

	root.StandardUnits = {
		WarSun: new root.UnitInfo(UnitType.WarSun, {
			
			battleValue: 3,
			battleDice: 3,
			bombardmentValue: 3,
			bombardmentDice: 3,
			cost: 12,
			sustainDamage: true,

			move: 2,
			capacity:6
		}),
		Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
			
			battleValue: 5,
			bombardmentValue: 5,
			bombardmentDice: 1,
			cost: 4,
			sustainDamage: true,

			move:1,
			capacity:1,
		}),
		Cruiser: new root.UnitInfo(UnitType.Cruiser, {
			battleValue: 7,
			cost: 2,

			move:2,
		}),
		Carrier: new root.UnitInfo(UnitType.Carrier, {
			battleValue: 9,
			cost: 3,
			move:1,
			capacity:4,
		}),
		Destroyer: new root.UnitInfo(UnitType.Destroyer, {
			battleValue: 9,
			barrageValue: 9,
			barrageDice: 2,
			cost: 1,

			move:2
		}),
		Fighter: new root.UnitInfo(UnitType.Fighter, {
			battleValue: 9,
			cost: 0.5,
		}),
		PDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 6,
			spaceCannonDice: 1,
			planetaryShield:true,
		}),
		Infantry: new root.UnitInfo(UnitType.Infantry, {
			battleValue: 8,
			cost: 0.5,
		}),

		SpaceDock: new root.UnitInfo(UnitType.SpaceDock, {
			hold: 3,
		}),


		Mech: new root.UnitInfo(UnitType.Mech, {
			
			battleValue: 6,
			cost: 2,
			sustainDamage: true,
		}),
		// ExperimentalBattlestation: new root.UnitInfo('Bloodthirsty Space Dock', {
		// 	spaceCannonValue: 5,
		// 	spaceCannonDice: 3,
		// }),
		// GhostHit: new root.UnitInfo('Ghost Hit', {
		// 	battleDice: 0,
		// 	cost:0,
		// }),
		// TheProgenitor: new root.UnitInfo('The Progenitor', {
		// 	spaceCannonValue: 5,
		// 	spaceCannonDice: 3,
		// 	cost:0,
		// }),
		// Planet: new root.UnitInfo(UnitType.Planet, {
		// 	spaceCannonValue: 3,
		// 	spaceCannonDice: 1,
		// 	cost:0,
		// }),
		Flagship: new root.UnitInfo(UnitType.Flagship, {
				
				battleValue: 7,
				battleDice: 2,
				cost: 8,
				sustainDamage: true,

				move:1,
				capacity: 3,

			}),
		
	};

	root.UniqueUnits = {

		// argent
		argentFlagship: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 7,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['argentFlagship'],
			capacity: 3,
			move: 1,
		}),
		
		argentDestroyer: new root.UnitInfo(UnitType.Destroyer, {
			
			battleValue: 8,
			cost: 1,
			barrageValue: 9,
			barrageDice: 2,
			
			move: 1,
			capacity: 1,
		}),
		argentDestroyerII: new root.UnitInfo(UnitType.Destroyer, {
			
			battleValue: 7,
			cost: 1,
			barrageValue: 6,
			barrageDice: 3,
			abilities: ['argentDestroyerII'],

			move: 2,
			capacity: 1,
		}),
		

		// Barony
		baronyDreadnought: new root.UnitInfo(UnitType.Dreadnought, {
			cost:3,
			battleValue:5,
			move:2,
			capacity:1,

			sustainDamage: true,
			bombardmentValue:4,
			bombardmentDice: 1,
			abilities:['directHitImmune']
		}),


		// Crimson
		crimsonFlagship: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 5,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['crimsonFlagship'],
			capacity: 3,
			move: 1,
		}),

		crimsonDestroyerTF: new root.UnitInfo(UnitType.Destroyer, {
			cost:1,
			battleValue: 8,
			move:4,

			barrageValue: 6,
			barrageDice: 3,
		}),




		// Empyrean
		empyreanFlagship: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 5,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['empyreanFlagship'],
			capacity: 3,
			move: 1,
		}),

		// Firmament
		firmamentWarSun: new root.UnitInfo(UnitType.WarSun, {
			cost: 12,
			battleValue: 3,
			battleDice:3,
			move: 2,
			capacity: 6,

			
			
			sustainDamage: true,
			bombardmentValue: 3,
			bombardmentDice: 3,
			abilities: ['firmamentWarSun'],
		}),


		// Keleres
		keleresCruiser: new root.UnitInfo(UnitType.Cruiser, {
			cost:2,
			combat:6,
			move:3,
			capacity:1,

			sustainDamage:true,
		}),


		// JolNar
		jolnarFlagship : new root.UnitInfo(UnitType.Flagship, {
			
			battleValue: 6,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['jolnarFlagship'],
			capacity:3,
			move:1,
			
		}),
		jolnarMech: new root.UnitInfo(UnitType.Mech, {
			
			battleValue: 6,
			cost: 2,
			sustainDamage: true,
			abilities: ['jolnarMech'],
		}),
		jolnarWarSun: new root.UnitInfo(UnitType.WarSun, {
			cost: 10,
			battleValue: 4,
			battleDice: 3,
			move: 3,
			capacity: 6,

			
			
			sustainDamage: true,
			bombardmentValue: 4,
			bombardmentDice: 3,
			abilities: ['warSun'],
		}),

		// L1Z1X
		l1z1xFlagship: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 5,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['l1z1xFlagship'],
			capacity: 5,
			move: 1,
		}),

		l1z1xDreadnoughtTF: new root.UnitInfo(UnitType.Dreadnought, {
			cost: 4,
			battleValue:5,
			move:2,
			capacity:2,

			sustainDamage:true,
			bombardmentValue:4,
			bombardmentDice:1,
			abilities:['directHitImmune']
		}),

		// Mentak
		mentakFlagship: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 7,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['mentakFlagship'],
			capacity: 3,
			move: 1,
		}),
		mentakMech: new root.UnitInfo(UnitType.Mech, {
			
			battleValue: 6,
			cost: 2,
			sustainDamage: true,
			abilities: ['mentakMech'],
		}),
		mentakCruiserIII: new root.UnitInfo(UnitType.Cruiser, {
			cost: 2,
			battleValue: 6,
			move:3,
			capacity: 2,
		}),

		// Muaat
		muaatWarSunTF: new root.UnitInfo(UnitType.WarSun, {
			cost: 12,
			battleValue: 3,
			battleDice:3,
			move: 2,
			capacity: 6,

			
			
			sustainDamage: true,
			bombardmentValue: 3,
			bombardmentDice: 3,
			abilities: ['warSun'],
		}),

		// Naalu
		naaluFighterII: new root.UnitInfo(UnitType.Fighter, {
			cost: 0.5,
			battleValue: 7,
			move:2,
			
			fleetPool: 0.5,
		}),

		// Naaz Rokha
		naazRokhaMech: new root.UnitInfo(UnitType.Mech, {
			
			battleValue: 6,
			battleDice: 2,
			cost: 2,
			sustainDamage: true,
		}),

		naazRokhaMechSpace: new root.UnitInfo(UnitType.Mech, {
			
			battleValue: 8,
			battleDice: 2,
			cost: 2,
			typeShip:true,
		}),

		naazRokhaFighter: new root.UnitInfo(UnitType.Fighter, {
			cost: 0.5,
			battleValue: 7,
			move:2,
			
			fleetPool: 1,
			abilities: ['naazRokhaFighter']
		}),




		// Nekro
		nekroFlagship: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 9,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['nekroFlagship'],
			capacity: 3,
			move: 1,
		}),
		nekroMech: new root.UnitInfo(UnitType.Mech, {
			
			battleValue: 6,
			cost: 2,
			sustainDamage: true,
			abilities: ['nekroMech'],
		}),

		// Nomad
		nomadFlagship: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 7,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			barrageValue: 8,
			barrageDice: 3,

			
			move: 1,
			capacity: 3,
		}),
		nomadFlagshipII: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 5,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			barrageValue: 5,
			barrageDice: 3,

			
			move: 2,
			capacity:6,
		}),
		nomadMech: new root.UnitInfo(UnitType.Mech, {
			
			battleValue: 6,
			cost: 2,
			sustainDamage: true,
			abilities: ['nomadMech'],
		}),

		// Ral Nel
		ralnelFlagship: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 8,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['ralnelFlagship'],
			capacity: 4,
			move: 2,
		}),
		ralnelMech: new root.UnitInfo(UnitType.Mech, {
			
			battleValue: 6,
			cost: 2,
			sustainDamage: true,
			abilities: ['ralnelMech'],
		}),
		ralnelDestroyer: new root.UnitInfo(UnitType.Destroyer, {
			
			battleValue: 9,
			cost: 1,
			barrageValue: 9,
			barrageDice: 2,
			abilities: ['ralnelDestroyer'],
			move:3
		}),
		ralnelDestroyerII: new root.UnitInfo(UnitType.Destroyer, {
			
			battleValue: 8,
			cost: 1,
			barrageValue: 6,
			barrageDice: 3,
			abilities: ['ralnelDestroyerII'],

			move: 4,
			upgraded: true,
		}),
		ralnelDestroyerTF: new root.UnitInfo(UnitType.Destroyer, {
			cost:1,
			battleValue: 8,
			move:2,

			barrageValue: 6,
			barrageDice: 3,
			abilities: ['ralnelDestroyerTF'],

			move: 4,
			upgraded: true,
		}),

		
		
		// Sardakk
		sardakkFlagship : new root.UnitInfo(UnitType.Flagship, {
			
			battleValue: 6,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['sardakkFlagship'],
			capacity:3,
			move:1,
			
		}),
		sardakkDreadnought : new root.UnitInfo(UnitType.Dreadnought, {
			battleValue: 5,
			bombardmentValue: 4,
			bombardmentDice: 2,
			cost: 4,
			sustainDamage: true,
			capacity:1,
			move:1,
		}),
		sardakkMech : new root.UnitInfo(UnitType.Mech, {
			battleValue: 6,
			cost: 2,
			sustainDamage: true,
			abilities: ['sardakkMech'],
		}),
		sardakkDreadnoughtII : new root.UnitInfo(UnitType.Dreadnought, {
			battleValue: 5,
			bombardmentValue: 4,
			bombardmentDice: 2,
			cost: 4,
			sustainDamage: true,
			abilities: ['directHitImmune', 'sardakkDreadnoughtII'],

			capacity:1,
			move:2,

		}),
		sardakkDreadnoughtTF : new root.UnitInfo(UnitType.Dreadnought, {
			battleValue: 4,
			bombardmentValue: 4,
			bombardmentDice: 2,
			cost: 4,
			sustainDamage: true,
			abilities: ['directHitImmune', 'sardakkDreadnoughtII'],

			capacity:1,
			move:2,

		}),

		// Sol
		solCarrierII : new root.UnitInfo(UnitType.Carrier, {
			cost: 3,
			battleValue: 9,
			move: 2,
			capacity:8,

			sustainDamage: true,
		}),


		// Titans
		titansPDS: new root.UnitInfo(UnitType.PDS, {
			battleValue:7,
			sustainDamage: true,
			spaceCannonValue: 6,
			spaceCannonDice: 1,
			planetaryShield:true,
			typeGroundForce:true,
		}),

		
		titansPDSII: new root.UnitInfo(UnitType.PDS, {
			battleValue:6,
			sustainDamage: true,
			spaceCannonValue: 5,
			spaceCannonDice: 1,
			planetaryShield:true,
			typeGroundForce:true,
			abilities: ['deepSpaceCannon']
		}),

		titansPDSTF: new root.UnitInfo(UnitType.PDS, {
			battleValue:5,
			sustainDamage: true,
			spaceCannonValue: 5,
			spaceCannonDice: 1,
			planetaryShield:true,
			typeGroundForce:true,
			abilities: ['deepSpaceCannon']
		}),

		// Winnu
		winnuPDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 5,
			spaceCannonDice: 1,
			planetaryShield:true,
			abilities: ['deepSpaceCannon', 'winnuPDS'],
		}),

		
		// Xxcha
		xxchaMech: new root.UnitInfo(UnitType.Mech, {
			battleValue: 6,
			cost: 2,
			sustainDamage: true,
			spaceCannonValue: 8,
			spaceCannonDice: 1,
			abilities: ['deepSpaceCannon'],
		}),
		xxchaPDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 5,
			spaceCannonDice: 2,
			planetaryShield:true,
			abilities: ['deepSpaceCannon'],
		}),
		

		

		

		

		

		

		

		

		

		

		

		



		// Red
		redFlagship: new root.UnitInfo(UnitType.Flagship, {
			cost: 8,
			battleValue: 5,
			battleDice: 2,
			move: 2,
			capacity: 3,
			
			sustainDamage: true,
		}),

		// Orange
		orangeFlagship: new root.UnitInfo(UnitType.Flagship, {
			cost: 8,
			battleValue: 7,
			battleDice: 2,
			move: 1,
			capacity: 6,
			
			sustainDamage: true,
			barrageValue: 5,
			barrageDice: 3,
		}),
		orangeMech: new root.UnitInfo(UnitType.Mech, {
			cost: 2,
			battleValue: 6,
			
			sustainDamage: true,
			planetaryShield: true,
			abilities: ['orangeMech'],
		}),

		// Yellow
		yellowFlagship: new root.UnitInfo(UnitType.Flagship, {
			cost: 8,
			battleValue: 9,
			battleDice: 2,
			move: 1,
			capacity: 1,
			
			sustainDamage: true,
		}),

		// Green
		greenFlagship: new root.UnitInfo(UnitType.Flagship, {
			cost: 8,
			battleValue: 7,
			battleDice: 2,
			move: 1,
			capacity: 6,
			
			sustainDamage: true,
		}),

		// Blue
		blueFlagship: new root.UnitInfo(UnitType.Flagship, {
			cost: 8,
			battleValue: 3,
			battleDice: 1,
			move: 2,
			capacity: 4,
			
			sustainDamage: true,
		}),
		blueMech: new root.UnitInfo(UnitType.Mech, {
			cost: 2,
			battleValue: 6,
			
			sustainDamage: true,
			abilities: ['blueMech'],
		}),

		// Purple
		purpleFlagship: new root.UnitInfo(UnitType.Flagship, {
			cost: 7,
			battleValue: 7,
			battleDice: 1,
			move: 7,
			capacity: 7,
			
			sustainDamage: true,
		}),
		purpleMech: new root.UnitInfo(UnitType.Mech, {
			cost: 2,
			battleValue: 6,
			
			sustainDamage: true,
			abilities: ['purpleMech'],
		}),


		//pink
		pinkFlagship: new root.UnitInfo(UnitType.Flagship, {
				
			battleValue: 5,
			battleDice: 2,
			cost: 8,
			sustainDamage: true,
			abilities: ['pinkFlagship'],

			
			move: 1,
			capacity: 3,
		}),

		// Black
		blackFlagship: new root.UnitInfo(UnitType.Flagship, {
			cost: 8,
			battleValue: 7,
			battleDice: 2,
			move: 1,
			capacity: 1,
			
			sustainDamage: true,
			bombardmentValue: 7,
			bombardmentDice: 1,
		}),
		blackMech: new root.UnitInfo(UnitType.Mech, {
			cost: 2,
			battleValue: 5,
			battleDice: 2,
			
			sustainDamage: true,
		}),
		

		// basic
		basicWarSun: new root.UnitInfo(UnitType.WarSun, {
				
			battleValue: 5,
			battleDice: 2,
			cost: 12,
			sustainDamage: true,
			bombardmentValue: 5,
			bombardmentDice:3,

			
			move: 0,
			capacity: 6,
		}),
		basicDreadnoughtII: new root.UnitInfo(UnitType.Dreadnought, {
				
			battleValue: 5,
			battleDice: 1,
			cost: 4,
			sustainDamage: true,
			bombardmentValue: 5,
			
			move: 2,
			capacity: 1,
		}),
	}

	
	


	

	root.StandardUpgrades = {
		// same as the regular Dreadnought, but upgrade affects ordering
		Dreadnought: new root.UnitInfo(UnitType.Dreadnought, {
			
			battleValue: 5,
			bombardmentValue: 5,
			bombardmentDice: 1,
			cost: 4,
			sustainDamage: true,
			abilities: ['directHitImmune'],

			move:2,
			capacity:1,
			// upgraded: true,
		}),
		Cruiser: new root.UnitInfo(UnitType.Cruiser, {
			battleValue: 6,
			cost: 2,
			// upgraded: true,

			move:3,
			capacity:1,
		}),
		Destroyer: new root.UnitInfo(UnitType.Destroyer, {
			battleValue: 8,
			barrageValue: 6,
			barrageDice: 3,
			cost: 1,

			move:2,
			// upgraded: true,
		}),
		Fighter: new root.UnitInfo(UnitType.Fighter, {
			battleValue: 8,
			cost: 0.5,

			move:2,
			fleetPool:1,
			// upgraded: true,

		}),
		PDS: new root.UnitInfo(UnitType.PDS, {
			spaceCannonValue: 5,
			spaceCannonDice: 1,
			planetaryShield:true,
			abilities: ["deepSpaceCannon"],
			// upgraded: true,
			
		}),
		Infantry: new root.UnitInfo(UnitType.Infantry, {
			battleValue: 7,
			cost: 0.5,
			// upgraded: true,
		}),

		// SpaceDock: new root.UnitInfo(UnitType.SpaceDock, {
		// 	hold: 3,
		// }),

		// Carrier: new root.UnitInfo(UnitType.Carrier, {
		// 	battleValue: 9,
		// 	cost: 3,
		// 	upgraded: true,
			
		// 	move: 2,
		// 	capacity: 6,
		// }),
	};

	
	root.MergedUnits = root.StandardUnits;
	root.MergedUpgrades = root.StandardUpgrades;

	root.getUnitSheets = function(objList){
		var output = Object.assign({}, root.StandardUnits);
		var outputUpgrades = Object.assign({}, root.StandardUpgrades);
		
		
		for (const unitName in root.UniqueUnitsOptions){
			
			if (objList[unitName]){
				const unit = root.UniqueUnits[unitName]
				output[unit.type] = unit;
			}
		}
		for (const unitName in root.UniqueUnitUpgradesOptions){
			
			
			if (objList[unitName]){
				const unit = root.UniqueUnits[unitName];
				outputUpgrades[unit.type] = unit;
			}
		}
		
		return [output, outputUpgrades]
	}
	

	root.fleetSort = function(fleet, battleType, thisSideOptions){

		fleet.sort(defaultComparer);


		
		const idx = fleet.findIndex(obj => !obj.leaveEarly);
		if (idx !== -1 && idx !== 0) {
			const [item] = fleet.splice(idx, 1); // remove it
			fleet.unshift(item); // move to end
		}
		


		function defaultComparer (unit1, unit2) {
			const unitOrder1= (unit1.cost === undefined || unit1.cost === null ? (unit1.typeStructure ? 100 : 0) : unit1.cost) + unit1.importance;
			const unitOrder2= (unit2.cost === undefined || unit2.cost === null ? (unit2.typeStructure ? 100 : 0) : unit2.cost) + unit2.importance;

			const cancelHitOrder = (unit1.cancelHit ? 1 : 0) - (unit2.cancelHit ? 1 : 0);
			if (cancelHitOrder !== 0) return cancelHitOrder;

			const immune1 = unit1.abilities.includes('directHitImmune') || unit1.damageCorporeal?.abilities.includes('directHitImmune');
			const immune2 = unit2.abilities.includes('directHitImmune') || unit2.damageCorporeal?.abilities.includes('directHitImmune');

			const damageGhostOrder = (unit1.isDamageGhost ? 1 : 0) - (unit2.isDamageGhost ? 1 : 0);
			if (thisSideOptions.riskDirectHit || thisSideOptions.riskSpark || (immune1 && unit1.isDamageGhost) || (immune2 && unit2.isDamageGhost) || !unit1.typeShip || !unit2.typeShip) {
				if (damageGhostOrder !== 0) return damageGhostOrder;
			}
			

			// const newOrder = (unit1.isDamageGhost && !unit2.isDamageGhost && unit1.damageCorporeal && unit1.damageCorporeal !== unit2 ? 1 : 0) - (unit2.isDamageGhost && !unit1.isDamageGhost  && unit2.damageCorporeal && unit2.damageCorporeal !== unit1 ? 1 : 0)
			// if (newOrder !== 0) return -newOrder;

			const typeOrder = unitOrder2 -  unitOrder1;
			if (typeOrder !== 0) return typeOrder;



			const combatOrder1 = (unit1.battleValue === null ? 0 : 10-unit1.battleValue) * (unit1.battleDice === null ? 0 : unit1.battleDice);
			const combatOrder2 = (unit2.battleValue === null ? 0 : 10-unit2.battleValue) * (unit2.battleDice === null ? 0 : unit2.battleDice);

			const combatOrder = combatOrder2 -  combatOrder1;
			if (combatOrder !== 0) return combatOrder;

			const notParticipatingOrder = (unit1.notParticipatingWhilePresent ? 1 : 0) - (unit2.notParticipatingWhilePresent ? 1 : 0);
			if (notParticipatingOrder !== 0) return notParticipatingOrder;

			const damagedOrder = (unit1.damaged ? 1 : 0) - (unit2.damaged ? 1 : 0); 
			if (damagedOrder !== 0) return damagedOrder;

			const damagedRoundOrder = (unit1.sustainedThisRound ? 1 : 0) - (unit2.sustainedThisRound ? 1 : 0);
			if (damagedRoundOrder !== 0) return damagedRoundOrder;

			
			if (damageGhostOrder !== 0) return damageGhostOrder;

			// const indexOrder = unit1.index - unit2.index;
			// return indexOrder;
			return 0;
		}

	}
	root.fluidCanon = function(thisSideCanon, thisSidePoles, thisSideOptions){
		const temp = {};
		var needCopy = false;
		for (const unitName in thisSidePoles){
			
			if (root.UniqueUnits.hasOwnProperty(unitName)){
				
				const unitTypeTemp =root.UniqueUnits[unitName].type;
				temp[unitTypeTemp] =root.UniqueUnits[unitName].clone();
				// temp[unitTypeTemp]._baseStats = structuredClone(game.UniqueUnits[unitName]._baseStats);
				needCopy = true;
				
				continue;
			}

			

			// const cut = unitName.charAt(0).toUpperCase() +unitName.slice(1,-2);		
			const cut = unitName
			if (root.StandardUpgrades.hasOwnProperty(cut)){
				const unitTypeTemp =root.StandardUpgrades[cut].type;
				temp[unitTypeTemp] =root.StandardUpgrades[cut].clone();
				// temp[unitTypeTemp]._baseStats = structuredClone(game.StandardUpgrades[cut]._baseStats);
				needCopy = true;
				continue;
				
			}
		}

		if (thisSideOptions.units.nomadFlagshipBuff || thisSidePoles.nomadFlagshipBuff !== undefined){
			temp[root.UnitType.Flagship] = temp[root.UnitType.Flagship] ? temp[root.UnitType.Flagship] : thisSideCanon[root.UnitType.Flagship].clone();

			temp[root.UnitType.Flagship].battleValue -= 1;
			temp[root.UnitType.Flagship].battleDice += 1;
			temp[root.UnitType.Flagship].move += 1;
			temp[root.UnitType.Flagship].capacity += 2;

			temp[root.UnitType.Flagship]._baseStats.battleValue -= 1;
			temp[root.UnitType.Flagship]._baseStats.battleDice += 1;
			temp[root.UnitType.Flagship]._baseStats.move += 1;
			temp[root.UnitType.Flagship]._baseStats.capacity += 2;

			needCopy = true;

			
		}

		
		if (thisSideOptions.units.naazRokhaMechBuff || thisSidePoles.naazRokhaMechBuff !== undefined){
			temp[root.UnitType.Mech] = temp[root.UnitType.Mech] ? temp[root.UnitType.Mech] : thisSideCanon[root.UnitType.Mech].clone();

			temp[root.UnitType.Mech].battleDice += 1;
			temp[root.UnitType.Mech]._baseStats.battleDice += 1;

			needCopy = true;
		}
		if (thisSideOptions.units.cabalMechBuff || thisSidePoles.cabalMechBuff !== undefined){
			temp[root.UnitType.Mech] = temp[root.UnitType.Mech] ? temp[root.UnitType.Mech] : thisSideCanon[root.UnitType.Mech].clone();

			temp[root.UnitType.Mech].battleValue -= 1;
			temp[root.UnitType.Mech]._baseStats.battleValue -= 1;

			needCopy = true;
		}
		if (thisSideOptions.units.nekroMechBuff || thisSidePoles.nekroMechBuff !== undefined){
			temp[root.UnitType.Mech] = temp[root.UnitType.Mech] ? temp[root.UnitType.Mech] : thisSideCanon[root.UnitType.Mech].clone();

			temp[root.UnitType.Mech].cost -= 1;
			temp[root.UnitType.Mech]._baseStats.cost -= 1;

			needCopy = true;
		}
		if (thisSideOptions.units.naazRokhaMechII || thisSidePoles.naazRokhaMechII !== undefined){
			temp[root.UnitType.Mech] = temp[root.UnitType.Mech] ? temp[root.UnitType.Mech] : thisSideCanon[root.UnitType.Mech].clone();

			temp[root.UnitType.Mech].battleValue = 4;
			temp[root.UnitType.Mech].battleDice = 4;
			temp[root.UnitType.Mech].move = 3;
			temp[root.UnitType.Mech].abilities = ['naazRokhaMechImmune', 'naazRokhaMechRepair']
			temp[root.UnitType.Mech].typeShip = true;

			temp[root.UnitType.Mech]._baseStats.battleValue = 4;
			temp[root.UnitType.Mech]._baseStats.battleDice = 4;
			temp[root.UnitType.Mech]._baseStats.move = 3;
			temp[root.UnitType.Mech]._baseStats.abilities = ['naazRokhaMechImmune', 'naazRokhaMechRepair']
			temp[root.UnitType.Mech]._baseStats.typeShip = true;

			needCopy = true;
		}
		

		if (needCopy){
			for (const key in thisSideCanon) {
				if (!temp.hasOwnProperty(key)) {
					temp[key] = thisSideCanon[key].clone();
				}
			}
			return temp;
		}
		return thisSideCanon;
	}

	


	root.createUnit = function(unitType, count, fleetToAdd, battleType, unitsCanon,  thisSideOptions, thisSidePoles, damagedCount, overrides){

		if (count === 0) return;
		
		var thisSideCanon = root.fluidCanon(unitsCanon, thisSidePoles, thisSideOptions)
		var addedUnit = thisSideCanon[unitType].clone(overrides);
		// addedUnit._baseStats = structuredClone(addedUnit._baseStats);

		
		if (damagedCount > 0){
			addedUnit.damaged=true;
			damagedCount --;
		}
		if (addedUnit.spaceArea === undefined || addedUnit.planet === undefined) {

			const isStructure = addedUnit.typeStructure;
			const planetUnit = addedUnit.typeGroundForce || isStructure;

			if (battleType === root.BattleType.Space) {
				addedUnit.planet = isStructure;
				addedUnit.spaceArea = !isStructure;
			}

			if (battleType === root.BattleType.Ground) {
				addedUnit.planet = planetUnit;
				addedUnit.spaceArea = !planetUnit;
			}
		}
		var modified = false;

		if (unitType === root.UnitType.Flagship){
			for (const unitName in root.FlagshipAbility){
				if (thisSideOptions.units[unitName] || thisSidePoles[unitName] !== undefined){
					const unit = root.UniqueUnits[unitName.slice(0,-7)]
					addedUnit.abilities.push(...unit.abilities);

					if (addedUnit._baseStats.abilities === undefined) addedUnit._baseStats.abilities = [];
					addedUnit._baseStats.abilities.push(...unit.abilities);

					modified = true;
				}
			}
			
		}
		
		if (unitType === root.UnitType.SpaceDock){
			if (thisSideOptions.lightrail){
				addedUnit.abilities.push('deepSpaceCannon');
				if ((2 * (11-5) || 0) > 
					(addedUnit.spaceCannonDice * (11-addedUnit.spaceCannonValue) || 0)){
						addedUnit.spaceCannonDice = 2;
						addedUnit.spaceCannonValue = 5;

						addedUnit._baseStats.spaceCannonDice = 2;
						addedUnit._baseStats.spaceCannonValue = 5;
				}
				modified = true;
			}	
		}

		if (addedUnit.abilities.includes('pinkFlagship')){
			
			for (const unitTypeStock of [root.UnitType.Cruiser, root.UnitType.Destroyer, root.UnitType.Dreadnought]){
				const stockUnit = thisSideCanon[unitTypeStock];
				
				addedUnit.abilities.push(...stockUnit.abilities);
				if (addedUnit._baseStats.abilities === undefined) addedUnit._baseStats.abilities = [];
				addedUnit._baseStats.abilities.push(...stockUnit.abilities);

				if (stockUnit.planetaryShield){ 
					addedUnit.planetaryShield = true;
					addedUnit._baseStats.planetaryShield = true;
				}
				if (stockUnit.sustainDamage){
					addedUnit.sustainDamage = true;
					addedUnit._baseStats.sustainDamage = true;
				}
				if ((stockUnit.barrageDice * (11-stockUnit.barrageValue) || 0) > 
				(addedUnit.barrageDice * (11-addedUnit.barrageValue) || 0)) 
				{
					addedUnit.barrageDice = stockUnit.barrageDice; 
					addedUnit.barrageValue = stockUnit.barrageValue;

					addedUnit._baseStats.barrageDice = stockUnit.barrageDice; 
					addedUnit._baseStats.barrageValue = stockUnit.barrageValue;
				}
				if ((stockUnit.spaceCannonDice * (11-stockUnit.spaceCannonValue) || 0) > 
				(addedUnit.spaceCannonDice * (11-addedUnit.spaceCannonValue)||0)){
					addedUnit.spaceCannonDice = stockUnit.spaceCannonDice; 
					addedUnit.spaceCannonValue = stockUnit.spaceCannonValue;

					addedUnit._baseStats.spaceCannonDice = stockUnit.spaceCannonDice; 
					addedUnit._baseStats.spaceCannonValue = stockUnit.spaceCannonValue;
				}
				if ((stockUnit.bombardmentDice * (11-stockUnit.bombardmentValue) || 0) > (addedUnit.bombardmentDice * (11-addedUnit.bombardmentValue)||0)){
					addedUnit.bombardmentDice = stockUnit.bombardmentDice; 
					addedUnit.bombardmentValue = stockUnit.bombardmentValue;

					addedUnit._baseStats.bombardmentDice = stockUnit.bombardmentDice; 
					addedUnit._baseStats.bombardmentValue = stockUnit.bombardmentValue;
				}

				modified = true;
			}
		}
			
		if (modified) {
			addedUnit.abilities = [...new Set(addedUnit.abilities)];
			addedUnit._baseStats.abilities = [...new Set(addedUnit.abilities)];
		}

		

		for (var i = 0; i < count; i++) {
			fleetToAdd.push(addedUnit.clone());
		}

		return fleetToAdd;


	}

	

	root.removeUnit = function(fleet, unitType, count, battleType, thisSideOptions){
		for (var i = fleet.length-1; i >=0 && count > 0; i--) {
			const unit = fleet[i];
			if (unit.type === unitType){
				fleet.splice(i,1);
				count--;
			}
		}
		root.fleetSort(fleet, battleType, thisSideOptions)
		

	}

	

	root.addUnit = function(unitType, count, fleetToAdd, battleType, unitsCanon, thisSideOptions, damagedCount, overrides){

		root.createUnit(unitType, count, fleetToAdd, battleType, unitsCanon,  thisSideOptions, {}, damagedCount, overrides);
		root.fleetSort(fleetToAdd, battleType, thisSideOptions);
		
	}



	root.filterFleet = function(fleet, battleType, battleSide, thisSideOptions) {
		var result = [];
		var resultNotParticipating = [];
		var naaluFlagship = fleet.some(obj => obj.abilities.includes('naaluFlagship') && !obj.notActiveSystem && battleType === root.BattleType.Ground && battleSide === root.BattleSide.attacker);
		var ralnelMech = fleet.some(obj => obj.abilities.includes('ralnelMech') && battleType === root.BattleType.Ground && !obj.notParticipatingWhilePresent && obj.presentPlanet);
		var copyHelTitan = thisSideOptions.copy.titansPDSIICopy;
		var nekroFlagship = fleet.some(obj => obj.abilities.includes('nekroFlagship') && battleType === root.BattleType.Space && !obj.notParticipatingWhilePresent && obj.presentSpace);

		for (var i = 0; i <fleet.length; i++) {
			var unit = fleet[i];

			var notParticipating = unit.notParticipatingWhilePresent || (!unit.presentPlanet && battleType === root.BattleType.Ground) || (!unit.presentSpace && battleType === root.BattleType.Space);
			var forceParticipate = false;

			if (unit.type === root.UnitType.Fighter && naaluFlagship){
				
				unit.update({typeGroundForce : true, leaveEarly: true});
			}

			if (unit.typeGroundForce && unit.notActiveSystem && unit.planet && ralnelMech){
				unit.update({invisible:true, immune:true, passive:true})
				forceParticipate = true;
			}

			if (unit.type === root.UnitType.Mech && unit.spaceArea && thisSideOptions.units.naazRokhaMech && !thisSideOptions.units.naazRokhaMechII && battleType === root.BattleType.Space && !thisSideOptions.articlesOfWar){
				unit.update({invisible:true, immune:true, passive:true});
				forceParticipate = true;
			}

			if (unit.type === root.UnitType.PDS && copyHelTitan){
				unit.update({invisible:true, immune:true, passive:true});
				forceParticipate = true;
			}

			if (unit.typeGroundForce && nekroFlagship && !unit.notActiveSystem){
				unit.update({invisible:true, immune:true, passive:true});
				forceParticipate = true;
			}

			
			if (unit.abilities.includes('purpleMech') && battleType === root.BattleType.Space && !thisSideOptions.articlesOfWar){
				unit.update({invisible:true, immune:true, passive:true});
				forceParticipate = true;
			}
			
		

			if (forceParticipate || !(notParticipating || (battleType === root.BattleType.Space && !unit.typeShip) || (battleType === root.BattleType.Ground && !unit.typeGroundForce))){
				result.push(unit);
			} else {
				resultNotParticipating.push(unit);
			}
		}
			

		return [result, resultNotParticipating];
	}

	root.fillOutFleet = function(fleet, battleType, thisSideOptions) {
		

		

		for (var i = 0; i < fleet.length; i++) {
			var unit = fleet[i];
			
			if (unit.sustainDamage && !unit.damaged && !unit.lostSustain && !unit.notUseSustain && unit.ghostCorporeal === undefined && !unit.invisible){
				
				var sustain=unit.toDamageGhost();
				fleet.push(sustain);
			}
				
		}
		root.fleetSort(fleet, battleType, thisSideOptions);
	}
	



	root.expandFleet = function(options, battleType, battleSide, thisSideCounters){
		var options = options || { attacker: {}, defender: {} };
		var battleType = battleType || 'Space';
		var thisSideOptions = options[battleSide];

		var result = [];
		
		for (var unitType in root.UnitType) {
			var counter=thisSideCounters[unitType];
			if (counter === undefined)
				counter = { count: 0, damaged:0 };
			else if (typeof counter == 'number')
				counter = { count: counter , damaged:0}
			else if (counter.count === undefined)
				counter.count = 0;
			if (counter.damaged === undefined)
				counter.damaged = 0;
			root.createUnit(unitType,counter.count, counter.damaged, counter.upgraded, undefined, result,battleType, thisSideOptions, thisSideCounters);
		}
		return result;
	}

	

	// Check whether the faction has an upgrade for the unit 
	root.upgradeable = function (unitType, unitVersions, twilightsFall, faction) {
		
		

		if (twilightsFall ){
			
			return true;
		}
		
		return unitVersions[unitType].upgraded.name;

		// return true
		// return true;
	};

	root.damageable = function (faction, unitType, upgraded, thisSideOptions) {

		// var [standardUnits, upgradedUnits] = root.getUnitSheets(thisSideOptions.units);
		// return (upgraded ? upgradedUnits : standardUnits)[unitType].sustainDamage;
		return false;
	};

	// root.hasBombardment = function (faction, unitType, upgraded, blitz) {
	// 	return (upgraded ? root.MergedUpgrades : root.MergedUnits)[faction][unitType].bombardmentDice > 0 || ((upgraded ? root.MergedUpgrades : root.MergedUnits)[faction][unitType].typeShip && blitz);
	// };

	
	
})(typeof exports === 'undefined' ? window : exports);
//window.alert(5 + 6);



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


	// === helpers (use your Object.byString if available; fallback provided) ===
	
}



// evaluateSettingExpression.js
function evaluateSettingExpression(exprTemplate, input, battleSide, root) {

if (exprTemplate === undefined){
	return false;
}

  function escapeDouble(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  // 1) Replace [side] and [otherSide] with bracket-access string literals,
  //    and remove any stray dot before a bracket (turns `units.[side]` -> `units["attacker"]`).
//   const sideLiteral = `["${escapeDouble(battleSide)}"]`;
//   const otherSideLiteral = `["${escapeDouble(root.BattleSide.opponent(battleSide))}"]`;

//   let expr = exprTemplate
//     .replace(/\[side\]/g, sideLiteral)
//     .replace(/\[otherSide\]/g, otherSideLiteral)
//     // remove dot that would become e.g. `.` + `["attacker"]` -> `["attacker"]`
//     .replace(/\.?\["/g, '["');

const sideLiteral = `${escapeDouble(battleSide)}`;
const otherSideLiteral = `${escapeDouble(root.BattleSide.opponent(battleSide))}`;

let expr = exprTemplate
    .replace(/\[side\]/g, sideLiteral)
    .replace(/\[otherSide\]/g, otherSideLiteral)
    // remove dot that would become e.g. `.` + `["attacker"]` -> `["attacker"]`
    

  

  // ---------- Tokenizer ----------
  function tokenize(s) {
    const tokens = [];
    let i = 0;

    const isIdentStart = ch => /[A-Za-z_$]/.test(ch);
    const isIdent = ch => /[A-Za-z0-9_$]/.test(ch);
    const isDigit = ch => /[0-9]/.test(ch);
    while (i < s.length) {
      const ch = s[i];

      // whitespace
      if (/\s/.test(ch)) { i++; continue; }

      // multi-char ops
      if (s.startsWith('===', i) || s.startsWith('!==', i) ||
          s.startsWith('<=', i) || s.startsWith('>=', i) ||
          s.startsWith('==', i) || s.startsWith('!=', i) ||
          s.startsWith('&&', i) || s.startsWith('||', i)) {
        const op = s.startsWith('===', i) || s.startsWith('!==', i)
                  ? s.substr(i, 3) : s.substr(i, 2);
        tokens.push({ type: 'op', value: op });
        i += op.length;
        continue;
      }

      // single-char tokens / ops
      if ('()!.<>[]{}.,'.includes(ch)) {
        tokens.push({ type: ch, value: ch });
        i++;
        continue;
      }

      // strings
      if (ch === '"' || ch === "'") {
        const quote = ch;
        i++;
        let str = '';
        while (i < s.length) {
          const c = s[i++];
          if (c === '\\') {
            const nxt = s[i++] || '';
            // simple escape handling
            if (nxt === 'n') str += '\n';
            else if (nxt === 't') str += '\t';
            else if (nxt === 'r') str += '\r';
            else str += nxt;
          } else if (c === quote) {
            break;
          } else {
            str += c;
          }
        }
        tokens.push({ type: 'string', value: str });
        continue;
      }

      // number
      if (isDigit(ch)) {
        let num = ch; i++;
        while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i++]; }
        tokens.push({ type: 'number', value: Number(num) });
        continue;
      }

      // identifier / true / false / null
      if (isIdentStart(ch)) {
        let id = ch; i++;
        while (i < s.length && isIdent(s[i])) id += s[i++];
        if (id === 'true' || id === 'false') {
          tokens.push({ type: 'boolean', value: id === 'true' });
        } else if (id === 'null') {
          tokens.push({ type: 'null', value: null });
        } else {
          tokens.push({ type: 'ident', value: id });
        }
        continue;
      }

      // unexpected char
      throw new SyntaxError('Unexpected char in expression: ' + ch + ' at ' + i);
    }
    tokens.push({ type: 'EOF' });
    return tokens;
  }

  // ---------- Parser (recursive descent) ----------
  function parse(tokens) {
    let pos = 0;
    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }
    function eat(type, value) {
      const t = peek();
      if (!t || t.type !== type || (value !== undefined && t.value !== value)) {
        throw new SyntaxError(`Expected ${type} ${value ?? ''} but got ${t && t.type}:${t && t.value}`);
      }
      pos++; return t;
    }

    // Grammar:
    // Expr := OrExpr
    // OrExpr := AndExpr ( '||' AndExpr )*
    // AndExpr := CompExpr ( '&&' CompExpr )*
    // CompExpr := Primary (compOp Primary)?
    // Primary := '!' Primary | '(' Expr ')' | literal | path
    // path := IDENT (('.' IDENT) | ('[' STRING|NUMBER|IDENT ']'))*

    function parseExpr() { return parseOr(); }
    function parseOr() {
      let node = parseAnd();
      while (peek().type === 'op' && peek().value === '||') {
        next(); const right = parseAnd();
        node = { type: 'or', left: node, right };
      }
      return node;
    }
    function parseAnd() {
      let node = parseComp();
      while (peek().type === 'op' && peek().value === '&&') {
        next(); const right = parseComp();
        node = { type: 'and', left: node, right };
      }
      return node;
    }
    function parseComp() {
      let node = parseNot();
      const t = peek();
      if (t.type === 'op' && ['===','!==','==','!=','<','>','<=','>='].includes(t.value)) {
        next();
        const right = parseNot();
        node = { type: 'cmp', op: t.value, left: node, right };
      }
      return node;
    }
    function parseNot() {
      if (peek().type === '!') {
        next();
        const operand = parseNot();
        return { type: 'not', operand };
      }
      return parsePrimary();
    }
    function parsePrimary() {
      const t = peek();
      if (t.type === '(') {
        next(); const node = parseExpr(); eat(')');
        return node;
      }
      if (t.type === 'string') { next(); return { type: 'literal', value: t.value }; }
      if (t.type === 'number') { next(); return { type: 'literal', value: t.value }; }
      if (t.type === 'boolean') { next(); return { type: 'literal', value: t.value }; }
      if (t.type === 'null') { next(); return { type: 'literal', value: null }; }
      if (t.type === 'ident') {
        return parsePath();
      }
      throw new SyntaxError('Unexpected token: ' + JSON.stringify(t));
    }

    function parsePath() {
      // start with ident
      const parts = [];
      let t = next(); // ident
      parts.push(t.value);

      while (true) {
        const p = peek();
        if (p.type === '.') {
          next(); // consume '.'
          const idTok = next();
          if (idTok.type !== 'ident') throw new SyntaxError('Expected identifier after dot');
          parts.push(idTok.value);
          continue;
        }
        if (p.type === '[') {
          next(); // consume [
          const inner = next();
          if (inner.type === 'string' || inner.type === 'number') {
            parts.push(inner.value);
          } else if (inner.type === 'ident') {
            // If user wrote [something] without quotes, treat as literal identifier string
            parts.push(inner.value);
          } else {
            throw new SyntaxError('Unsupported bracket index type: ' + inner.type);
          }
          eat(']'); // consume ]
          continue;
        }
        break;
      }
      return { type: 'path', parts };
    }

    const ast = parseExpr();
    if (peek().type !== 'EOF') throw new SyntaxError('Unexpected trailing tokens');
    return ast;
  }

  // ---------- Evaluator ----------
  function resolvePath(rootObj, parts) {
    let cur = rootObj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function evalNode(node) {
    switch (node.type) {
      case 'literal': return node.value;
      case 'path': return resolvePath(input, node.parts);
      case 'not': return !toBoolean(evalNode(node.operand));
      case 'and': return toBoolean(evalNode(node.left)) && toBoolean(evalNode(node.right));
      case 'or': return toBoolean(evalNode(node.left)) || toBoolean(evalNode(node.right));
      case 'cmp': {
        const L = evalNode(node.left);
        const R = evalNode(node.right);
        switch (node.op) {
          case '===': return L === R;
          case '!==': return L !== R;
          case '==': return L == R;
          case '!=': return L != R;
          case '<': return L < R;
          case '>': return L > R;
          case '<=': return L <= R;
          case '>=': return L >= R;
        }
        throw new Error('Unknown comparison op ' + node.op);
      }
      default: throw new Error('Unknown node type ' + node.type);
    }
  }

  function toBoolean(v) {
    return !!v;
  }

  // run it
  const tokens = tokenize(expr);
  const ast = parse(tokens);
  return evalNode(ast);
}

