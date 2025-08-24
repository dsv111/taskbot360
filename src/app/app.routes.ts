import { Routes } from '@angular/router';
import { HomeComponent } from '../pages/home/home.component';
import { ChatComponent } from '../pages/chat/chat.component';
import { SignupComponent } from '../pages/signup/signup.component';

export const routes: Routes = [
    {path:'',component:HomeComponent},
    {path:'chat',component:ChatComponent},
    {path:'login',component:SignupComponent},
    { path: '**', redirectTo: '' }

];
