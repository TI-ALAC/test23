// Outcon Helper v2.0.1  -  Mar 16th, 2021

if (typeof Outcon === 'undefined'){

	Outcon = class {

		constructor(pod){
			this.outconURL = "https://api.outcondigital.com";
			this.bufferedAds = [];
			this.demo = false;
			this.bufferSize = 0;
			this.pod = pod;
			this.buffering = false;
			this.checkOutconURL();
		}

		enableDemoMode() {
			this.demo = true;
		}

		async getAd(toBuffer=false) {
			if (this.pod == '') {
				console.error("Outcon POD isn't defined");
				return null;
			}

			if(!toBuffer && this.bufferedAds.length > 0){
				let res = this.bufferedAds.shift();
				this.fillBuffer();
				return res;
			}

			let url = this.outconURL + "/ad/get?pod=" + this.pod + '&demo=' + this.demo.toString();
			let ad;
			try{
				ad = JSON.parse(await this.fetch(url));
			}catch(e){
				return null;
			}
			ad.preloadedObject = null;
			if (ad.creatives) {
				ad.requestedDate = (new Date()).valueOf();
				if(toBuffer){
					this.bufferedAds.push(ad);
					this.preloadContent(ad, true, false, true);
					console.log("Outcon: Buffered ad "+ad.creatives[0].id)
					return;
				}
			}
			return ad;
		}

		show(elementId, ad=null){
			let object = this.getHtml(ad)
			if (object === null) return false;
			if (!elementId) {
				console.error("Outcon: Missing target element's ID")
				return false;
			}
			let elem = document.getElementById(elementId);
			if (!elem) {
				console.error("Outcon: Can't find element id "+elementId);
				return false;
			}
			while(elem.firstChild) elem.removeChild(elem.firstChild);
			this.initVideo(object);
			const HTMLToAdd = document.createElement('div');
			HTMLToAdd.style = 'position:absolute;width:100vw;height:100vh;opacity:0';
			HTMLToAdd.innerHTML = (ad.creatives[0].dynamicContent||{}).HTML||'';
			document.getElementById(elementId).append(HTMLToAdd);
			const CSSToAdd = document.createElement('style');
			CSSToAdd.innerHTML = (ad.creatives[0].dynamicContent||{}).CSS||'';
			const scriptToAdd = document.createElement('script');
			window.dynamicContent = ad.creatives[0].dynamicContent;
			scriptToAdd.innerHTML = (ad.creatives[0].dynamicContent||{}).JS||'';
			elem.appendChild(object);
			if(object.tagName.toLowerCase() === 'video'){
				document.querySelector('video').addEventListener('loadeddata', () => {
					document.getElementById(elementId).appendChild(CSSToAdd);
					document.querySelector('body').appendChild(scriptToAdd);
					HTMLToAdd.style.opacity = 1;
				});
			}
			else{
				document.getElementById(elementId).appendChild(CSSToAdd);
				document.querySelector('body').appendChild(scriptToAdd);
				HTMLToAdd.style.opacity = 1;
			}
			return true;
		}

		getHtml(ad=null, track=true) {
			if (this.pod == '') {
				console.error("Outcon: POD isn't defined");
				return null;
			}
			if (ad == null && this.bufferedAds.length === 0) {
				console.warn("Outcon: No ads to show. Please call outcon.startBuffering first or wait a few seconds...");
				return null;
			}
			if(ad == null) ad = this.bufferedAds.shift();
			if(!ad.preloadedObject) this.preloadContent(ad, false, true, false);
			if (track) this.track(ad);
			this.fillBuffer();
			return ad.preloadedObject;
		}

		initVideo(object){
			if(object.tagName.toLowerCase() === 'video') {
                console.log("ingresando")
				object.pause();
				object.muted = false;
				object.currentTime = 0;
				object.play();
			}
			object.style="width:100vw;height:100vh;object-fit:contain;";
		}

		preloadContent(ad, muted, preload, autoplay){
			if (ad.type == 'video'){
				ad.preloadedObject = document.createElement("video");
				ad.preloadedObject.muted = muted;
				ad.preloadedObject.preload = preload;
				let source = document.createElement("source");
				source.src = ad.creatives[0].url;
				ad.preloadedObject.appendChild(source);
				if(autoplay) ad.preloadedObject.play();
			}else if (ad.type == 'banner'){
				ad.preloadedObject = new Image();
				ad.preloadedObject.src = ad.creatives[0].url;
			}
			ad.preloadedObject.style="width:100%;height:100%;object-fit:cover;";
		}

		async track(ad){
			try{
				if(!ad.impressionId) return;
				if(!ad.insertionDate) ad.insertionDate = (new Date()).valueOf();
				await this.fetch(this.outconURL + "/ad/track?track=" + ad.impressionId.toString() + "&timeToDisplay=" + (ad.insertionDate - ad.requestedDate));
				console.log('Outcon: Succesfully tracked Ad impression for '+ad.impressionId);
			}catch(e){
				console.warn('Outcon: Error tracking Ad impression for '+ad.impressionId+' Will retry in 5 secs.');
				await this.sleep(5000);
				this.track(ad);
			}
		}

		sleep(ms){
			return new Promise(resolve => setTimeout(resolve, ms));
		}

		startBuffering(b) {
			this.bufferSize = b;
			this.fillBuffer();
		}

		async fillBuffer() {
			if(this.buffering) return true;
			this.buffering = true;
			while (this.bufferedAds.length < this.bufferSize){
				await this.getAd(true);
				await this.sleep(2000);
			}
			while(this.bufferedAds.length > this.bufferSize){
				this.bufferedAds.shift();
			}
			this.buffering = false;
			return true;
		}

		stopBuffering() {
			this.bufferSize = 0;
			this.bufferedAds = [];
			return true;
		}

		fetch(url){
			return new Promise((resolve, reject) => {
				// compatible with IE7+, Firefox, Chrome, Opera, Safari
				let xmlhttp = new XMLHttpRequest();
				xmlhttp.onreadystatechange = ()=>{
					if(xmlhttp.readyState != 4) return;
					if((xmlhttp.status) && (xmlhttp.status < 200 || xmlhttp.status >=300)){
						reject(xmlhttp.status);
						return;
					}
					resolve(xmlhttp.responseText);
				}
				xmlhttp.open("GET", url, true);
				xmlhttp.send();
			});
		}

		async updateOutconURL(){
			let newOutconURL;
			try{
				JSON.parse(await this.fetch("http://localhost:7622/status"));
				newOutconURL = "http://localhost:7622";
			}catch(e){
				newOutconURL = "https://api.outcondigital.com";
			}
			if(this.outconURL != newOutconURL){
				console.log("Old URL " + this.outconURL);
				console.log("New URL " + newOutconURL);
				this.outconURL = newOutconURL;
				this.bufferedAds = [];
				this.fillBuffer();
			}
		}

		checkOutconURL(){
			setInterval(async() => {
				await this.updateOutconURL();
			}, 60000);
		}
	}
}