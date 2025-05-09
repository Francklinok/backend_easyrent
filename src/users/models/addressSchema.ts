import { Schema,  model } from "mongoose";
import { Address } from "../userTypes/userTypes";


const  addressSchema = new Schema<Address>({
    street:{
        type:String,
        required:false,
    },
    city:{
        type:String,
        required:true,
    },
    state:{
        type:String,
        required:false,

    },
    postalCode:{
        type:String,
        required:false
    },
    country:{
        type:String,
        required:true,
    },
    coordinates:{
        latitude:Number,
        longitude:Number
    }
    }
)

// const Address = model<Address>("Address",addressSchema)

export default addressSchema;