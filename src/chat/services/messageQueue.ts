class MessageQueue{
    private queue: Array<()=>Promise<void>> = [];
    private  processing = false;
    private readonly maxConcurrent = 5;
    private active = 0;


    async  add(task: ()=>Promise<void> ):Promise<void>{
       return  new Promise((resolve, reject) =>{
        this.queue.push(async() =>{
            try{
                await  task();
                resolve();
            }catch(error){
                reject(error)
            }
        })
        this.process()})
    }

    private   async process():Promise<void>{
        if(this.processing || this.active >= this.maxConcurrent) return ;

        const task  = this.queue.shift();
        if(!task) return ;
        this.active ++;
        this.processing  = true;

        try{
            await task();
        }finally{
            this.active --;
            this.processing = false;
            if(this.queue.length > 0){
                this.process()
            }
        }
    }

}

export  default MessageQueue